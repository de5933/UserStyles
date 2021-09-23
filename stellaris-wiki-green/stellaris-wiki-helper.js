// ==UserScript==
// @name         Stellaris Theme Helper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Tweaks for the Stellaris theme
// @author       You
// @match        https://stellaris.paradoxwikis.com/*
// @grant        none
// ==/UserScript==

/*
For use with https://raw.githubusercontent.com/de5933/UserStyles/master/stellaris-wiki-green/stellaris-wiki-green.css
The reference table at the bottom of each article has all of its styles defined in style attributes. None of the components have classes. 
It's almost impossible to apply my own styles to the table because (A) It has no class name, and (B) Inline styles override class styles. 
Solution: This script identifies the table, adds a className to it, and strips out the problematic inline styles. 
*/

(function() {
	'use strict';
	// Find bottom table and add class
	var footerTable = [...document.querySelectorAll('div.mw-parser-output>div')].filter(x => x.style.border)[0];
	footerTable.className = 'footerTable';

	[
			footerTable,
			...footerTable.querySelectorAll('div,table,td'),
			...document.getElementById('catlinks').children,
			document.getElementById('catlinks')
	].forEach(element => {
			if (element.style.backgroundColor) {
					element.style.backgroundColor = '';
			}
			if (element.style.background) {
					element.style.background = '';
			}
			if (element.style.border) {
					element.style.border = '';
			}
	});
})();