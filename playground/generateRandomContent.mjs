import {writeFileSync} from "fs";
import { randomBytes } from "crypto";
function randBetween(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function main() {
	let arr = [];
	for(let i = 0; i < 200; i++) {
		arr.push({
			index: i+1,
			title: `generated content ${i + 1}`,
			fname: `generated-${i + 1}`
		})
	}
	for(let i = 0; i < arr.length; i++) {
		let one = randBetween(0, arr.length - 1);
		let two = randBetween(0, arr.length - 1);
		let three = randBetween(0, arr.length - 1);
		let cur = arr[i];
		while(one === i || one === two || one === three) {
			one = randBetween(0, arr.length - 1); 
		}
		while(two === i || two === one || two === three) {
			two = randBetween(0, arr.length - 1)
		}
		while(three === i || three === one || three === two) {
			three = randBetween(0, arr.length - 1);
		}
		let content = `---
title: '${arr[i].title}'
index: ${i + 1}
---
[[random/${arr[one].fname}]]
[[random/${arr[two].fname}]]
[[random/${arr[three].fname}]]
`
		writeFileSync(`src/content/random/${cur.fname}.md`, content)
	}
}

main()