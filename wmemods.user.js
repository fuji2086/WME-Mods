// ==UserScript==
// @name         WME Mods
// @version      2024.03.31.02
// @description  Modifies the Waze Map Editor to suit my needs
// @author       fuji2086
// @match        *://*.waze.com/*editor*
// @exclude      *://*.waze.com/user/editor*
// @grant        GM_xmlhttpRequest
// @require      https://greasyfork.org/scripts/39002-bluebird/code/Bluebird.js?version=255146
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @connect      greasyfork.org
// @connect      wv.gov
// @license      GNU GPLv3
// @downloadURL  https://update.greasyfork.org/scripts/491345/WME%20Mods.user.js
// @updateURL    https://update.greasyfork.org/scripts/491345/WME%20Mods.user.js
// ==/UserScript==

/* global W */
/* global $ */
/* global OpenLayers */
/* global I18n */
/* global WazeWrap */

'use strict';

const SETTINGS_STORE_NAME = 'wme_mods';
const SCRIPT_NAME = GM_info.script.name;
const SCRIPT_VERSION = GM_info.script.version;
const DOWNLOAD_URL = 'https://greasyfork.org/scripts/491345/code/WME%20Mods.user.js';
const UPDATE_MESSAGE = 'Changed the min zoom level for road type highlighting';
let _settings = {};
let _mapLayer = null;
const MAP_LAYER_Z_INDEX = 375;
const MIN_ZOOM_LEVEL = 14;
let _lastPromise = null;
let _lastContext = null;
let _rtCallCount = 0;
const STATES_HASH = {
    Alabama: 'AL',
    Alaska: 'AK',
    'American Samoa': 'AS',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    'District of Columbia': 'DC',
    'Federated States Of Micronesia': 'FM',
    Florida: 'FL',
    Georgia: 'GA',
    Guam: 'GU',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    'Marshall Islands': 'MH',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    'Northern Mariana Islands': 'MP',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Palau: 'PW',
    Pennsylvania: 'PA',
    'Puerto Rico': 'PR',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    'Virgin Islands': 'VI',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY'
};

const STATE_SETTINGS = {
    global: {
        roadTypes: ['St', 'StUp', 'OR'],
        getFeatureRoadType(feature, layer) {
            const rt = feature.attributes[layer.rtPropName];
            return this.getRoadTypeFromRT(rt, layer);
        },
        getRoadTypeFromRT(rt, layer) {
            return Object.keys(layer.roadTypeMap).find(rti => layer.roadTypeMap[rti].indexOf(rt) !== -1);
        },
        isPermitted(stateAbbr) {
            return (true);
        },
        getMapLayer(stateAbbr, layerID) {
            let returnValue;
            STATE_SETTINGS[stateAbbr].rtMapLayers.forEach(layer => {
                if (layer.layerID === layerID) {
                    returnValue = layer;
                }
            });
            return returnValue;
        }
    },
    WV: {
        baseUrl: 'https://gis.transportation.wv.gov/arcgis/rest/services/Roads_And_Highways/Publication_LRS/MapServer/',
        defaultColors: {
            OR: '#000000', StUp: '#ffa500', St: '#eeeeee'
        },
        zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
        rtMapLayers: [
            {
                layerID: 70,
                rtPropName: 'SURFACE_TYPE',
                idPropName: 'OBJECTID',
                outFields: ['OBJECTID', 'SURFACE_TYPE', 'ROUTE_ID'],
                maxRecordCount: 1000,
                supportsPagination: true,
                roadTypeMap: {
                    OR: [1], StUp: [3], St: [6]
                }
            }
        ],
        information: { Source: 'WV DOT' },
        isPermitted() { return true; },
        getWhereClause(context) {
            if (context.mapContext.zoom < 16) {
                return `${context.layer.rtPropName} NOT IN (9,19)`;
            }
            return null;
        },
        getFeatureRoadType(feature, layer) {
            if (layer.getFeatureRoadType) {
                return layer.getFeatureRoadType(feature);
            }
            const rtCode = feature.attributes[layer.rtPropName];
            let rt = rtCode;
            if (rtCode <= 2) rt = 1;
            else if (rtCode <= 5) rt = 3;
            else rt = 6;
            const id = feature.attributes.ROUTE_ID;
            return STATE_SETTINGS.global.getRoadTypeFromRT(rt, layer);
        }
    }
};

function log(message) {
    console.log('RT Layer: ', message);
}
function debugLog(message) {
    console.debug('RT Layer: ', message);
}
function errorLog(message) {
    console.error('RT Layer: ', message);
}

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

function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        // If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function getLineWidth() {
    return 12 * (1.15 ** (W.map.getZoom() - 13));
}

function sortArray(array) {
    array.sort((a, b) => { if (a < b) return -1; if (a > b) return 1; return 0; });
}

function getUrl(context, queryType, queryParams) {
    const { extent } = context.mapContext;
    const { zoom } = context.mapContext;
    const { layer } = context;
    const { state } = context;

    const whereParts = [];
    const geometry = {
        xmin: extent.left, ymin: extent.bottom, xmax: extent.right, ymax: extent.top, spatialReference: { wkid: 102100, latestWkid: 3857 }
    };
    const geometryStr = JSON.stringify(geometry);
    const stateWhereClause = state.getWhereClause(context);
    const layerPath = layer.layerPath || '';
    let url = `${state.baseUrl + layerPath + layer.layerID}/query?geometry=${encodeURIComponent(geometryStr)}`;

    if (queryType === 'countOnly') {
        url += '&returnCountOnly=true';
    } else if (queryType === 'idsOnly') {
        url += '&returnIdsOnly=true';
    } else if (queryType === 'paged') {
        // TODO
    } else {
        url += `&returnGeometry=true&maxAllowableOffset=${state.zoomSettings.maxOffset[zoom - 12]}`;
        url += `&outFields=${encodeURIComponent(layer.outFields.join(','))}`;
        if (queryType === 'idRange') {
            whereParts.push(`(${queryParams.idFieldName}>=${queryParams.range[0]} AND ${queryParams.idFieldName}<=${queryParams.range[1]})`);
        }
    }
    if (stateWhereClause) whereParts.push(stateWhereClause);
    if (whereParts.length > 0) url += `&where=${encodeURIComponent(whereParts.join(' AND '))}`;
    url += '&spatialRel=esriSpatialRelIntersects&geometryType=esriGeometryEnvelope&inSR=102100&outSR=3857&f=json';
    return url;
}

function getAsync(url, context) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            context,
            method: 'GET',
            url,
            onload(res) {
                if (res.status.toString() === '200') {
                    resolve({ responseText: res.responseText, context });
                } else {
                    reject(new Error({ responseText: res.responseText, context }));
                }
            },
            onerror() {
                reject(Error('Network Error'));
            }
        });
    });
}

function onSave() {
    if (!$('.zoom-bar-container')) {
        waitForElm('.zoom-bar-container').then(AddZoomDisplay);
    }
}

function toggleRoadTypeHighlight(firstrun = false) {
    if (_settings.roadTypeEnabled) {
        W.map.addLayer(_mapLayer);
        _mapLayer.setZIndex(MAP_LAYER_Z_INDEX);

        setInterval(checkLayerZIndex, 200);

        WazeWrap.Events.register('moveend', null, fetchAllRT);
        fetchAllRT();
        _settings.layerVisible = true;
        _mapLayer.setVisibility(true);
        $('#layer-switcher-item_rt_layer').prop('checked', true);
    } else if (!firstrun) {
        W.map.removeLayerByName('RT Layer');
        WazeWrap.Events.unregister('moveend', null, fetchAllRT);
    }
}

function fetchLayerRT(context) {
    const url = getUrl(context, 'idsOnly');
    debugLog(url);
    if (!context.parentContext.cancel) {
        return getAsync(url, context).bind(context).then(res => {
            const ids = $.parseJSON(res.responseText);
            if (!ids.objectIds) ids.objectIds = [];
            sortArray(ids.objectIds);
            debugLog(ids);
            return ids;
        }).then(res => {
            const idRanges = [];
            if (res.objectIds) {
                const len = res.objectIds ? res.objectIds.length : 0;
                let currentIndex = 0;
                const offset = Math.min(context.layer.maxRecordCount, 1000);
                while (currentIndex < len) {
                    let nextIndex = currentIndex + offset;
                    if (nextIndex >= len) nextIndex = len - 1;
                    idRanges.push({ range: [res.objectIds[currentIndex], res.objectIds[nextIndex]], idFieldName: res.objectIdFieldName });
                    currentIndex = nextIndex + 1;
                }
                debugLog(context.layer.layerID);
                debugLog(idRanges);
            }
            return idRanges;
        }).map(idRange => {
            if (!context.parentContext.cancel) {
                const newUrl = getUrl(context, 'idRange', idRange);
                debugLog(newUrl);
                return getAsync(newUrl, context).then(res => {
                    if (!context.parentContext.cancel) {
                        let { features } = $.parseJSON(res.responseText);
                        context.parentContext.callCount++;
                        debugLog('Feature Count=' + (features ? features.length : 0));
                        features = features || [];
                        return features.map(feature => convertRTToRoadTypeVectors(feature, context))
                            .filter(vector => !(vector[0].attributes.roadType === 'St' && _settings.hideStreet));
                    }
                    return null;
                });
            }
            debugLog('Async call cancelled');
            return null;
        });
    }
    return null;
}

function convertRTToRoadTypeVectors(feature, context) {
    const { state, stateAbbr, layer } = context;
    const roadType = state.getFeatureRoadType(feature, layer);
    // debugLog(feature);
    const zIndex = STATE_SETTINGS.global.roadTypes.indexOf(roadType) * 100;
    const attr = {
        state: stateAbbr,
        layerID: layer.layerID,
        roadType,
        dotAttributes: $.extend({}, feature.attributes),
        color: state.defaultColors[roadType],
        strokeWidth: getLineWidth,
        zIndex
    };
    const vectors = feature.geometry.paths.map(path => {
        const pointList = path.map(pt => new OpenLayers.Geometry.Point(pt[0], pt[1]));
        return new OpenLayers.Feature.Vector(new OpenLayers.Geometry.LineString(pointList), attr);
    });

    return vectors;
}

function fetchStateRT(context) {
    const state = STATE_SETTINGS[context.stateAbbr];
    const contexts = state.rtMapLayers.map(layer => ({
        parentContext: context.parentContext, layer, state, stateAbbr: context.stateAbbr, mapContext: context.mapContext
    }));

    return Promise.map(contexts, ctx => fetchLayerRT(ctx));
}

function fetchAllRT() {
    if (!_mapLayer || !_mapLayer.visibility) return;

    if (_lastPromise) { _lastPromise.cancel(); }
    $('#mods-loading-indicator').text('Loading RT...');

    const mapContext = { zoom: W.map.getZoom(), extent: W.map.getExtent() };
    if (mapContext.zoom > MIN_ZOOM_LEVEL) {
        const parentContext = { callCount: 0, startTime: Date.now() };

        if (_lastContext) _lastContext.cancel = true;
        _lastContext = parentContext;
        const contexts = getVisibleStateAbbrs().map(stateAbbr => ({ parentContext, stateAbbr, mapContext }));
        const map = Promise.map(contexts, ctx => fetchStateRT(ctx)).then(statesVectorArrays => {
            if (!parentContext.cancel) {
                _mapLayer.removeAllFeatures();
                statesVectorArrays.forEach(vectorsArray => {
                    vectorsArray.forEach(vectors => {
                        vectors.forEach(vector => {
                            vector.forEach(vectorFeature => {
                                _mapLayer.addFeatures(vectorFeature);
                            });
                        });
                    });
                });
            }
            return statesVectorArrays;
        }).catch(e => {
            $('#mods-loading-indicator').text('RT Error! (check console for details)');
            errorLog(e);
        }).finally(() => {
            _rtCallCount -= 1;
            if (_rtCallCount === 0) {
                $('#mods-loading-indicator').text('');
            }
        });

        _rtCallCount += 1;
        _lastPromise = map;
    } else {
        // if zoomed out too far, clear the layer
        _mapLayer.removeAllFeatures();
    }
}

function checkLayerZIndex() {
    if (_mapLayer.getZIndex() !== MAP_LAYER_Z_INDEX) {
        // ("ADJUSTED MODS LAYER Z-INDEX " + _mapLayerZIndex + ', ' + _mapLayer.getZIndex());
        _mapLayer.setZIndex(MAP_LAYER_Z_INDEX);
    }
}

function onLayerCheckboxChanged(checked) {
    if (!_settings.roadTypeEnabled && checked) {
        _settings.roadTypeEnabled = checked;
        $('#mods-hlrt').prop('checked', checked);
        toggleRoadTypeHighlight();
    }
    setVisible(checked);
}

function onLayerVisibilityChanged() {
    setVisible(_mapLayer.visibility);
}

function setVisible(value) {
    _settings.layerVisible = value;
    saveSettings();
    _mapLayer.setVisibility(value);
    if (value) fetchAllRT();
    $('#layer-switcher-item_rt_layer').prop('checked', _settings.layerVisible);
}

function loadSettings() {
    const loadedSettings = $.parseJSON(localStorage.getItem(SETTINGS_STORE_NAME));
    const defaultSettings = {
        lastVersion: null,
        layerVisible: true,
        roadTypeEnabled: false
    };
    _settings = loadedSettings || defaultSettings;
    Object.keys(defaultSettings).filter(prop => !_settings.hasOwnProperty(prop)).forEach(prop => {
        _settings[prop] = defaultSettings[prop];
    });
}

function saveSettings() {
    if (localStorage) {
        _settings.lastVersion = SCRIPT_VERSION;
        _settings.layerVisible = _mapLayer.visibility || false;
        localStorage.setItem(SETTINGS_STORE_NAME, JSON.stringify(_settings));
    }
}

function getVisibleStateAbbrs() {
    const visibleStates = [];
    W.model.states.getObjectArray().forEach(state => {
        const stateAbbr = STATES_HASH[state.attributes.name];
        const { activeStateAbbr } = _settings;
        if (STATE_SETTINGS[stateAbbr] && STATE_SETTINGS.global.isPermitted(stateAbbr) && (!activeStateAbbr || activeStateAbbr === 'ALL' || activeStateAbbr === stateAbbr)) {
            visibleStates.push(stateAbbr);
        }
    });
    return visibleStates;
}

function addLoadingIndicator() {
    $('.loading-indicator').after($('<div class="loading-indicator" style="margin-right:10px" id="mods-loading-indicator">'));
}

function initLayer() {
    const defaultStyle = new OpenLayers.Style({
            strokeColor: '${color}', // '#00aaff',
            strokeDashstyle: 'solid',
            strokeOpacity: 1.0,
            strokeWidth: '${strokeWidth}',
            graphicZIndex: '${zIndex}'
        });

        const selectStyle = new OpenLayers.Style({
            // strokeOpacity: 1.0,
            strokeColor: '#000000'
        });

        _mapLayer = new OpenLayers.Layer.Vector('RT Layer', {
            uniqueName: '__RTLayer',
            displayInLayerSwitcher: false,
            rendererOptions: { zIndexing: true },
            styleMap: new OpenLayers.StyleMap({
                default: defaultStyle,
                select: selectStyle
            })
        });

        _mapLayer.setOpacity(0.5);

        I18n.translations[I18n.locale].layers.name.__RTLayer = 'RT Layer';

        _mapLayer.displayInLayerSwitcher = true;
        _mapLayer.events.register('visibilitychanged', null, onLayerVisibilityChanged);
        _mapLayer.setVisibility(_settings.layerVisible);

        WazeWrap.Interface.AddLayerCheckbox('Display', 'RT Layer', _settings.layerVisible, onLayerCheckboxChanged);
}


function initGUI() {
    addLoadingIndicator();
    initLayer();
    let tab = $("<div>", {style:"padding:8px 16px", id:"mods-settings"});
    tab.html([
        '<b>WME Mods</b> v' + GM_info.script.version,
        '</br>',
        '<div><input type="checkbox" name="mods-hlrt" title="Turn this on to highlight segments based on road type" id="mods-hlrt"><label for="mods-hlrt">Highlight Segment Road Type</label></div>',
    ].join(' '));
    WazeWrap.Interface.Tab('Mods', tab.html(), initGUI2, 'Mods');
}

function initGUI2() {
    $('#mods-hlrt').change(function() {
        _settings.roadTypeEnabled = this.checked;
        toggleRoadTypeHighlight();
        saveSettings();
    });
    $('#mods-hlrt').prop('checked', _settings.roadTypeEnabled);
}

function initZoom() {
    AddZoomDisplay();
    W.map.events.register("zoomend", null, UpdateZoomDisplay);
    W.editingMediator.actionManager.events.register("afterclearactions",null,onSave);
}

function sriptInit(){
    if (WazeWrap?.Ready) {
        WazeWrap.Interface.ShowScriptUpdate(SCRIPT_NAME, SCRIPT_VERSION, UPDATE_MESSAGE, DOWNLOAD_URL);
        try {
            const updateMonitor = new WazeWrap.Alerts.ScriptUpdateMonitor(SCRIPT_NAME, SCRIPT_VERSION, DOWNLOAD_URL, GM_xmlhttpRequest);
            updateMonitor.start();
        } catch (ex) {
            // Report, but don't stop if ScriptUpdateMonitor fails.
            console.error(`${SCRIPT_NAME}:`, ex);
        }
        loadSettings();
        initZoom();
        initGUI();
        toggleRoadTypeHighlight(true);
    } else {
        unsafeWindow.setTimeout(sriptInit, 250);
    }
}

document.addEventListener("wme-ready", sriptInit, {once: true});