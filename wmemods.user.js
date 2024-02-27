// ==UserScript==
// @name         WME Mods
// @version      2024.02.27.01
// @description  Modifies the Waze Map Editor to suit my needs
// @author       fuji2086
// @match        https://beta.waze.com/*editor*
// @match        https://www.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @require         https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @license      GNU GPLv3
// @grant        none
// ==/UserScript==

/* global W */

function UpdateZoomDisplay() {
    try {
        const zoomBar = $('.zoom-bar-container')[0];
        const zoomDisplayLevel = $('#zoomdisplaycontainer > p')[0];
        const zoomLevel = W.map.getZoom();

        zoomDisplayLevel.innerText = zoomLevel;
        switch (zoomLevel) {
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
                zoomBar.style.background = '#ef9a9a';
                break;
            case 14:
            case 15:
                zoomBar.style.background = '#ffe082';
                break;
            default:
                zoomBar.style.background = '#ffffff';
                break;
        }
    }
    catch {
        AddZoomDisplay();
    }
}

async function AddZoomDisplay() {
    const zoomBar = $('.zoom-bar-container')[0];
    const zoomDisplayContainer = $('<div>', {id:'zoomdisplaycontainer', style:'width:100%;'});
    zoomDisplayContainer.append($('<p>', {id:'zoomdisplaylevel', style:'font-size:20px;text-align:center;margin:0px;'}));
    zoomDisplayContainer.insertAfter(zoomBar.firstChild);
    UpdateZoomDisplay();
}

function ScriptInit()
{
    AddZoomDisplay();
    W.map.events.register("zoomend", null, UpdateZoomDisplay);
    W.editingMediator.actionManager.events.register("afterclearactions",null,AddZoomDisplay);
}

document.addEventListener("wme-ready", ScriptInit, {once: true});
