import {
	quadtree,
	type Force,
	type SimulationNodeDatum,
	type SimulationLinkDatum,
} from "d3";
import { type Rect, type LabelProps } from "./types";

function rectsOverlap(a: Rect, b: Rect, padding: number) {
	return !(
		a.x + a.width + padding <= b.x ||
		b.x + b.width + padding <= a.x ||
		a.y + a.height + padding <= b.y ||
		b.y + b.height + padding <= a.y
	);
}

function rectCenter(r: Rect) {
	return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}

export interface AnchoredLabelCollideForce<T extends SimulationNodeDatum & { labelProps?: LabelProps; id: string }, L extends SimulationLinkDatum<T>> extends Force<T, L> {
  getAnchor(fn: (d: T) => { x: number; y: number } | null): this;
  padding(value: number): this;
  iterations(value: number): this;
  collideStrength(value: number): this;
  anchorStrength(value: number): this;
  maxDistance(value: number): this;
  damping(value: number): this;
  overlapEpsilon(value: number): this;
}

export function forceAnchoredLabelCollide<
	T extends SimulationNodeDatum & { labelProps?: LabelProps; id: string },
	L extends SimulationLinkDatum<T>
>(opts?: {
	padding?: number;
	iterations?: number;

	// Collision response strength (scaled by alpha)
	collideStrength?: number;

	// Pull back toward the preferred offset (scaled by alpha)
	anchorStrength?: number;

	// Hard clamp: label offset distance from node cannot exceed this
	maxDistance?: number;

	// 0..1 (lower = more damping, less jitter, but slower to settle)
	damping?: number;

	// Ignore tiny overlaps to avoid micro-jitter
	overlapEpsilon?: number;

	// Optional: set preferred offset explicitly; default is "whatever labelProps is on initialize"
	getAnchor?: (d: T) => { x: number; y: number } | null;
}): AnchoredLabelCollideForce<T, L> {
	let padding = opts?.padding ?? 6;
	let iterations = opts?.iterations ?? 2;

	let collideStrength = opts?.collideStrength ?? 1.0;
	let anchorStrength = opts?.anchorStrength ?? 0.2;
	let maxDistance = opts?.maxDistance ?? 80;
	let damping = opts?.damping ?? 0.75;
	let overlapEpsilon = opts?.overlapEpsilon ?? 0.25;
	let getAnchor = opts?.getAnchor ?? null;

	let nodes: T[] = [];

	const hasPos = (d: T) => d.x != null && d.y != null;

	function getAbsRect(d: T): Rect | null {
		if (!hasPos(d) || !d.labelProps) return null;
		const lp = d.labelProps;
		return {
			x: (d.x as number) + lp.x,
			y: (d.y as number) + lp.y,
			width: lp.width,
			height: lp.height,
		};
	}

	function clampOffsetToMaxDistance(lp: LabelProps) {
		const dx = lp.x;
		const dy = lp.y;
		const r = Math.hypot(dx, dy);
		if (r <= maxDistance || r === 0) return;

		const s = maxDistance / r;
		lp.x *= s;
		lp.y *= s;

		// Remove velocity component pushing outward to reduce “buzzing” on the boundary
		lp._vx = (lp._vx ?? 0) * 0.5;
		lp._vy = (lp._vy ?? 0) * 0.5;
	}

	function ensureInternals(d: T) {
		const lp = d.labelProps;
		if (!lp) return;

		if (lp._vx == null) lp._vx = 0;
		if (lp._vy == null) lp._vy = 0;

		// Preferred anchor offset: default to initial offset at initialization time,
		// or allow user override via getAnchor.
		const a = getAnchor ? getAnchor(d) : null;
		if (a) {
			lp._baseX = a.x;
			lp._baseY = a.y;
		} else {
			if (lp._baseX == null) lp._baseX = lp.x;
			if (lp._baseY == null) lp._baseY = lp.y;
		}

		// If the preferred base itself is too far, clamp it once.
		const br = Math.hypot(lp._baseX ?? 0, lp._baseY ?? 0);
		if (br > maxDistance && br !== 0) {
			const s = maxDistance / br;
			lp._baseX = (lp._baseX ?? 0) * s;
			lp._baseY = (lp._baseY ?? 0) * s;
		}
	}

	function force(alpha: number) {
		// Run a few relaxation passes per tick
		for (let it = 0; it < iterations; it++) {
			// Build quadtree using absolute label centers
			const qt = quadtree<T>()
				.x((d) => {
					const r = getAbsRect(d);
					return r ? r.x + r.width / 2 : NaN;
				})
				.y((d) => {
					const r = getAbsRect(d);
					return r ? r.y + r.height / 2 : NaN;
				})
				.addAll(nodes.filter((d) => getAbsRect(d) != null));

			// Pairwise collision pushes (store as velocity deltas)
			for (const aNode of nodes) {
				if (!aNode.labelProps || !hasPos(aNode)) continue;
				ensureInternals(aNode);

				const aRect = getAbsRect(aNode);
				if (!aRect) continue;

				const ax0 = aRect.x - padding;
				const ay0 = aRect.y - padding;
				const ax1 = aRect.x + aRect.width + padding;
				const ay1 = aRect.y + aRect.height + padding;

				qt.visit((q, x0, y0, x1, y1) => {
					if (x0 > ax1 || x1 < ax0 || y0 > ay1 || y1 < ay0) return true;

					if (!q.length) {
						let leaf: any = q;
						do {
							const bNode = leaf.data as T;
							if (
								bNode &&
								bNode !== aNode &&
								bNode.labelProps &&
								hasPos(bNode)
							) {
								// Process each pair once to reduce oscillation/jitter
								if (String(aNode.id) >= String(bNode.id)) {
									leaf = leaf.next;
									continue;
								}

								ensureInternals(bNode);

								const bRect = getAbsRect(bNode);
								if (!bRect) {
									leaf = leaf.next;
									continue;
								}

								if (rectsOverlap(aRect, bRect, padding)) {
									const A = rectCenter(aRect);
									const B = rectCenter(bRect);

									const halfW = aRect.width / 2 + bRect.width / 2 + padding;
									const halfH = aRect.height / 2 + bRect.height / 2 + padding;

									const dx = A.cx - B.cx;
									const dy = A.cy - B.cy;

									const overlapX = halfW - Math.abs(dx);
									const overlapY = halfH - Math.abs(dy);

									if (overlapX > overlapEpsilon && overlapY > overlapEpsilon) {
										// Push along the smaller overlap axis (minimal displacement)
										const aLP = aNode.labelProps!;
										const bLP = bNode.labelProps!;

										if (overlapX < overlapY) {
											const sx = (dx === 0 ? 1 : Math.sign(dx)) * overlapX;
											const push = sx * 0.5 * collideStrength * alpha;

											aLP._vx = (aLP._vx ?? 0) + push;
											bLP._vx = (bLP._vx ?? 0) - push;
										} else {
											const sy = (dy === 0 ? 1 : Math.sign(dy)) * overlapY;
											const push = sy * 0.5 * collideStrength * alpha;

											aLP._vy = (aLP._vy ?? 0) + push;
											bLP._vy = (bLP._vy ?? 0) - push;
										}
									}
								}
							}

							leaf = leaf.next;
						} while (leaf);
					}

					return false;
				});
			}

			// Anchor pull + integrate offsets + clamp
			for (const n of nodes) {
				const lp = n.labelProps;
				if (!lp || !hasPos(n)) continue;
				ensureInternals(n);

				const baseX = lp._baseX ?? 0;
				const baseY = lp._baseY ?? 0;

				// Pull back toward preferred anchor offset
				const ax = (baseX - lp.x) * anchorStrength * alpha;
				const ay = (baseY - lp.y) * anchorStrength * alpha;

				lp._vx = ((lp._vx ?? 0) + ax) * damping;
				lp._vy = ((lp._vy ?? 0) + ay) * damping;

				lp.x += lp._vx;
				lp.y += lp._vy;

				clampOffsetToMaxDistance(lp);
			}
		}
	}

	force.initialize = (initNodes: T[]) => {
		nodes = initNodes;
		// Capture initial offsets as the “anchor” so labels prefer to stay near where
		// you initially place them (reduces jitter + drifting).
		for (const n of nodes) {
			if (!n.labelProps) continue;
			ensureInternals(n);
		}
	};
  force.getAnchor = (fn: (d: T) => { x: number; y: number } | null) => {
    getAnchor = fn;
    return force;
  }
  force.padding = (value: number) => {
    padding = value;
    return force;
  }
  force.iterations = (value: number) => {
    iterations = value;
    return force;
  }
  force.collideStrength = (value: number) => {
    collideStrength = value;
    return force;
  }
  force.anchorStrength = (value: number) => {
    anchorStrength = value;
    return force;
  }
  force.maxDistance = (value: number) => {
    maxDistance = value;
    return force;
  }
  force.damping = (value: number) => {
    damping = value;
    return force;
  }
  force.overlapEpsilon = (value: number) => {
    overlapEpsilon = value;
    return force;
  }

	return force;
}
