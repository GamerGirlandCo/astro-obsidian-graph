export function suburl(url: string) {
	let args: ((cv: string) => any[])[] = [() => [1]];
	let suburl = args.reduce((pv, cv) => {
		console.log(pv);
		return String.prototype.substring.apply(pv, cv(pv) as [number, number]);
	}, url);
	if (suburl.endsWith("/"))
		suburl = suburl.substring(0, suburl.lastIndexOf("/"));
	console.log("SUB", suburl);
	return `/${suburl}`;
}
