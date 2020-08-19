/* eslint no-unused-vars: warn */
/* eslint no-undef: warn */
import d3 from '@Project/d3-importer.js';
import StringHelpers from '@Submodule/UTILS';
import s from './styles.scss';
import dictionary from '@Project/data/dictionary.json';
import { fieldValues, returnNestedData } from '@Project/scripts/data.js';
import { OrganizeBy } from '@Project/store.js';
import organize from './organize.js';

var organizeBy;

OrganizeBy.subscribe(v => {
    organizeBy = v;
    _organize(v);
});

var Sections = [];
// [{rfmo: [{section: <section>, rows:[<row>,<row>,...],{},...}]}]
// construct a model of the sections and their rows when they are rendered so that
// we don't need to query the DOM for them every time we need to refer to them later
function logSection(depth, d, i, arr) {
    var sect = {
        section: arr[i],
        rows: arr[i].querySelectorAll('tr.js-row-level-' + depth)
    };

    Sections[depth] = Sections[depth] || {};
    Sections[depth][d.key] = Sections[depth][d.key] || [];
    Sections[depth][d.key].push(sect);
    console.log(Sections);
}

function _organize(orgBy) {
    // TOOO somewhere, open the children is orgBy array warrant it
    if (orgBy == undefined) {
        return;
    }
    [3, 2, 1, 0].forEach(i => {
        if (Sections[i]) {
            if (orgBy[i] == undefined) {
                Object.values(Sections[i]).forEach(nodeArr => {
                    nodeArr.forEach(node => {
                        node.section.style.display = 'block';
                    });
                });
            } else {
                Object.values(Sections[i]).forEach(nodeArr => {
                    nodeArr.forEach(node => {
                        node.section.style.display = 'none';
                    });
                });
                if (Sections[i][orgBy[i]]) {
                    Sections[i][orgBy[i]].forEach(node => {
                        node.section.style.display = 'block';
                        if (orgBy[i + 1]) {
                            node.rows.forEach(row => {
                                if ( !row.isExpanded ){
                                    row.dispatchEvent(new MouseEvent('click', {
                                        view: window,
                                        bubbles: true,
                                        cancelable: true
                                    }));
                                }
                            });
                        }
                    });
                }
            }
        }

    });
}

if (module.hot) {
    module.hot.accept('./styles.scss');
}

const margin = {
    top: 5,
    right: 35,
    bottom: 5,
    left: 5
};
const viewBoxHeight = 50;
const height = viewBoxHeight - margin.top - margin.bottom;
const width = 100 - margin.left - margin.right;
const yScale = d3.scaleLinear().range([height, 0]);
const xScale = d3.scaleLinear().range([0, width]);
const valueline = d3.line()
    .x(d => {
        return xScale(d.x);
    })
    .y(d => {
        return yScale(d.p);
    });

function formatTypes(precision) {
    return {
        v: `,.${precision}~s`,
        dv: `$,.${precision}~s`,
        ev: `$,.${precision}~s`
    }
}
const tip = d3.tip()
    //.direction('n')
    .attr('class', `${s['d3-tip']} ${s.n}`)
    //.offset([-8, 0])
    .html((d, i, arr) => {
        return d.reduce(function(acc, cur, j) {
            return acc + `<div class="${s.tooltipDiv}${i == j ? ' ' + s.currentYear : ''}">${cur.x}: ${abbrev({value: cur.y, type: cur.column, precision: 3})}</div>`;
        }, `<section class="${s[d[0].column]}"><h1 class="${s.tooltipHead}">${display(d[0].column)}</h1>`) + '</section>';
    });

function hashValues(d) {
    return d.reduce((acc, cur) => acc + cur.value, '').hashCode();
}

function display(key) {
    return dictionary[key].display;
}

function displayFilters(filters) {
    if (filters.length == 0) {
        return '';
    }
    return filters.reduce(function(acc, cur, i, arr) {
        return acc + `<span>${display(cur[0])}:</span> ${display(cur[1])} `;
    }, '(') + ')';
}

function description(key) {
    return dictionary[key].description;
}

function abbrev({ value, type, precision }) {
    return d3.format(formatTypes(precision)[type])(value).replace('G', 'B');
}

function units(key) {
    return dictionary[key].units;
}

function returnSubcontainer(parent) {
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.setAttribute('colspan', fieldValues.property.size + 1);
    cell.classList.add(s.childCell);
    row.appendChild(cell);
    parent.insertAdjacentElement('afterend', row);
    return cell;
}
d3.formatLocale({
    decimal: '.',
    thousands: ',',
    grouping: [3],
    currency: ['$', '']
});

function rowClickHandler(d, sortBy, sortDirection) {
    if (this.classList.contains('js-child-is-loaded')) {
        this.isExpanded = !this.isExpanded;
        return; // here handle the expanding/collapsing of already loaded children
        // include aria-expanded, etc.
    }
    Object.defineProperty(this, 'isExpanded', {
        get: function() { return this._isExpanded; },
        set: function(value) {
            this._isExpanded = value;
            this.setAttribute('aria-expanded', value);
            this.classList[value ? 'add' : 'remove'](s.isExpanded);
            this.expansionChild.classList[value ? 'add' : 'remove'](s.isExpandedChild)
            this.button.setAttribute('aria-label', value ? 'Click to collapse row' : 'Click to expand row');
        }
    });
    var rowKeys = JSON.parse(this.dataset.keys);
    var rowValues = JSON.parse(this.dataset.values);
    var rowFilters = rowKeys.map((key, i) => [key, rowValues[i]]);
    this.button = this.querySelector('.js-expand-button');
    this.classList.add('js-child-is-loaded');
    this.expansionChild = initCharts({ filters: rowFilters, sortBy, sortDirection, appendAfter: this });
    this.isExpanded = true;
}
export function initCharts({ filters = [], sortBy = 'ev', sortDirection = 'desc', appendAfter = null }) {
    // filters = Array of key, value arrays corresponding to the row clicked
    var nestedData = returnNestedData(filters);
    var container = !appendAfter ? d3.select('#render-here') : d3.select(returnSubcontainer(appendAfter));
    if (filters.length > 0) {
        container
            .attr('id', filters.map(f => f[1]).join('-'));
    }

    function returnDatum(datum) {
        return datum.values.map((value, i, arr) => {
            return {
                row: datum.key,
                column: datum.parent.key,
                x: value.key,
                y: value.value,
                z: (value.value - datum.parent.mean) / datum.parent.deviation,
                p: (value.value - arr[0].value) / arr[0].value
            };
        });
    }

    function initTooltips(datum) {
        var cell = d3.select(this);
        var svg = cell.select('svg');
        var bars = svg.selectAll('.' + s.dummyBars + ' rect');
        svg.call(tip);
        bars
            .data(years.map(() => returnDatum(datum)))
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);
    }

    function sortFieldValues(d, a, b) {
        var columnValues = d.values.find(d => d.key == sortBy).values;
        var ab = [a, b].map(fv => {
            var yearValues = columnValues.find(d => d.key == fv).values;
            return yearValues.length > 0 ? yearValues[yearValues.length - 1].value : 0;
        });
        return sortDirection == 'desc' ? ab[1] - ab[0] : ab[0] - ab[1];
    }

    function createSVG(datum) {
        console.log('in createSVG');
        if (datum.descendantValues.every(d => d === 0)) {
            this.textContent = 'n.a.';
            return;
        }
        var greatestExtent = Math.max(Math.abs(datum.parent.parent.parent.minP), Math.abs(datum.parent.parent.parent.maxP));
        yScale.domain([-greatestExtent, greatestExtent]); // scale each line based on min.max domain from parent pValues

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var _svg = d3.select(svg)
            .attr('class', s.chartSVG)
            .attr('viewBox', '0 0 100 ' + viewBoxHeight)
            //.attr('focusable', false)
            .attr('xmlns', 'http://www.w3.org/2000/svg')
            .attr('version', '1.1')
            .attr('role', 'img')
            .attr('aria-labelledby', `title-${filters.map(f => f[1]).join('-')}-${datum.parent.parent.key}-${datum.key}-${datum.parent.key} ` +
                `desc-${filters.map(f => f[1]).join('-')}-${datum.parent.parent.key}-${datum.key}-${datum.parent.key}`);

        _svg.append('title')
            .attr('id', `title-${filters.map(f => f[1]).join('-')}-${datum.parent.parent.key}-${datum.key}-${datum.parent.key}`)
            .text(() => {
                return `Line graph showing the ${display(datum.parent.key)} of tuna caught ` +
                    `in each of ${datum.values.length} years for ${display(datum.parent.parent.key)}: ` +
                    `${display(datum.key)}.`;
            });

        _svg.append('desc')
            .attr('id', `desc-${filters.map(f => f[1]).join('-')}-${datum.parent.parent.key}-${datum.key}-${datum.parent.key}`)
            .text(() => {
                return datum.values.reduce(function(acc, cur, j) {
                    return acc + `${cur.key}: ${abbrev({value: cur.value, type: cur.parent.parent.key, precision: 3})}${ j < datum.values.length - 1 ? '; ' :''}`;
                }, '');
            });

        var g = _svg
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`)
            .datum(returnDatum(datum));

        g.append('path')
            .attr('d', valueline)
            .attr('class', `${s.sparkline} ${s[datum.parent.key]}`); //parent key to get class of column, not row

        g.append('g')
            .attr('class', s.circles)
            .selectAll('circle')
            .data(d => d)
            .enter().append('circle')
            .attr('cx', d => xScale(d.x))
            .attr('cy', function(d) {
                return yScale(d.p);
            })
            .attr('r', 3)
            .attr('class', s[datum.parent.key]) //parent key to get class of column, not row
            .classed(s.isLast, (d, i, arr) => i == arr.length - 1);

        g.append('text')
            .attr('class', `${s.dataPoint} ${s[datum.parent.key]}`)
            .attr('x', d => xScale(d[d.length - 1].x))
            .attr('y', d => yScale(d[d.length - 1].p))
            .attr('dy', '0.3em')
            .attr('dx', '0.5em')
            .text(d => abbrev({ value: d[d.length - 1].y, type: datum.parent.key, precision: 3 }));

        g.append('g')
            .attr('class', s.dummyBars)
            .selectAll('rect')
            .data(d => {
                return d;
            })
            .enter().append('rect')
            .attr('x', (d, i, arr) => xScale(d.x) - ((width) / (arr.length - 1)) / 2)
            .attr('width', (d, i, arr) => (width) / (arr.length - 1))
            .attr('height', height);


        this.appendChild(svg);

    }
    var years = Array.from(fieldValues.year.values()).sort();
    xScale.domain([years[0], years[years.length - 1]]);
    var sections = container
        .selectAll('section')
        .data(nestedData.values, function(d) { return d ? d.key : this.getAttribute('data-key'); });

    {
        let entering = sections
            .enter().append('section')
            .attr('class', `js-chart-section js-chart-section${filters.length} ${s.chartSection} ${s['chartSection' + filters.length]}`)
            .classed(s.isLastSection, nestedData.values.length == 1)
            .attr('data-key', d => d.key)
            .style('display', function(d) {
                if (!organizeBy || organizeBy[filters.length] == undefined || organizeBy[filters.length] == d.key) {
                    return 'block'
                }
                return 'none';
            });



        // here you should assign the section to a variable or object in more general scope so 
        // that existing sections can be handle on subscribe to OrganizeBy
        entering.append('h' + (filters.length + 2))
            .attr('class', s.sectionHead)
            .html(d => `<a id="head-${d.key}" class="${s.headAnchor}"></a><span>${display(d.key)}</span> <span class="${s.filtersDisplay}">${displayFilters(filters)}</span>`);

        if (filters.length === 0) { //only add graf when no filters applied, ie, main tables

            entering.append('p')
                .attr('class', s.intro)
                .text(d => description(d.key));
        }

        let table = entering.append('table');

        if (filters.length === 0) { // table headers only if no filters applied, ie, main tables
            table.append('thead')
                .selectAll('th')
                .data(d => ['', ...fieldValues.property])
                .enter().append('th')
                .attr('scope', (d, i) => i == 0 ? null : 'column')
                .attr('class', d => s[d])
                .classed(s.sortedBy, d => {
                    return d == sortBy;
                })
                .classed(s.asc, d => d == sortBy && sortDirection == 'asc')
                .html(d => d ? `${display(d)}${ units(d) ? ' <span class="' + s.units + '">(' + units(d) + ')</span>' : ''}` : '');
        }

        table.append('tbody');

        // handling enter separately for prerenderin
        sections = sections.merge(entering);
    }
    sections.each(function(data) {
        var section = d3.select(this);
        var rows = section.selectAll('tbody')
            .selectAll('tr')
            .data(() => {
                var rtn = [...fieldValues[data.key]].sort(sortFieldValues.bind(undefined, data));
                return rtn;
            }, function(_d) { // this second parameter of `.data()` sets the key by which to identify each data-bound element
                // needs to be IDd so that on page load the prerendered elements are not rerendered
                // `_d` is undefined for the prerendered elements captured by selectAll, so return that `data-value`
                // attribute instead.
                console.log(_d);
                return _d ? JSON.stringify([...filters.map(f => f[1]), _d]) : this.getAttribute('data-values');
            });

        {
            let entering = rows
                .enter().append('tr')
                .attr('data-keys', JSON.stringify([...filters.map(f => f[0]), data.key]))
                .attr('data-values', d => JSON.stringify([...filters.map(f => f[1]), d])) // eg W, IO, IA, etc
                .attr('class', 'js-row-level-' + filters.length);

            if (nestedData.values.length > 1) { // do not do expansion stuff if we're at the last branch of the tree
                entering
                    .attr('title', 'Click to expand')
                    .attr('aria-expanded', false)
                    .attr('aria-controls', d => [...filters.map(f => f[1]), d].join('-'))
            }

            let th = entering.append('th');

            th.attr('scope', 'row');
            th.text(d => display(d));
            if (nestedData.values.length > 1) {
                th.append('button')
                    .attr('class', 'js-expand-button ' + s.expandButton)
                    .attr('aria-label', 'Click to expand row');
            }

            rows = rows.merge(entering);
            rows.exit().remove();
            if (nestedData.values.length > 1) {
                rows.on('click', function(d) {
                    rowClickHandler.call(this, d, sortBy, sortDirection);
                });
            }
        }

        // remember the rendering of the tables follows a different sequence then the nesting of the data so we
        // have to manually find the data needed for each the cells of each row
        var cells = rows.selectAll('td') // TODO: seems this setup must not be right. why call hashValues twice?
            .data(d => {
                var _d = [...fieldValues.property].map(p => data.values.find(_d => _d.key == p).values.find(__d => __d.key == d));
                return _d;
            }, function(d) { return d ? hashValues(d.values) : this.getAttribute('data-hash'); });

        {
            let entering = cells
                .enter().append('td')
                .attr('data-hash', d => {
                    return hashValues(d.values);
                })
                .attr('class', d => s[d.parent.key])
                .each(createSVG);

            cells = cells.merge(entering);
            cells.exit().remove();
            cells.each(initTooltips);

        }
        /* cells.selectAll('svg.' + s.chartSVG)
             .call(tip);
         
         cells.selectAll('.' + s.dummyBars + ' rect' )
             .on('mouseover', tip.show)
             .on('mouseout', tip.hide);*/



    });
    sections.each(logSection.bind(undefined, filters.length));
    /*
        d3.selectAll('svg.' + s.chartSVG)
            .call(tip);
     
        d3.selectAll('.' + s.dummyBars + ' rect' )
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);*/
    return container.node();
}