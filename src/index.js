/* eslint no-unused-vars: warn */
/* eslint no-undef: warn */
//import "core-js/stable";
//import "regenerator-runtime/runtime";
import './css/styles.scss';
//import { fieldValues, returnNestedData } from './scripts/data.js';
import { initCharts } from '@Project/components/charts/';

initCharts({filters: []});
//initCharts({filters: [['rfmo','W'],['species','ALB'],['gear','GN']]});
document.dispatchEvent(new Event('custom-render-trigger'));