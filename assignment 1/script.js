const margin = { top: 40, right: 100, bottom: 20, left: 50};
// const cellSize = 40;
const cellWidth = 80;
const cellHeight = 48;
const padding = 6;

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");

let data = [];
let metric = "max";

d3.csv("temperature_daily.csv").then(rows => {
  const all = rows.map(r => {
    const [year, month, day] = r.date.split("-").map(Number);
    return { year, month, day, max: +r.max_temperature, min: +r.min_temperature };
  });

  // last 10 years' data
  const lastYear = d3.max(all, d=>d.year);
  data = all.filter(d => d.year > lastYear - 10);

  draw();
});
d3.select("#btn-max").on("click", () => setMetric("max"));
d3.select("#btn-min").on("click", () => setMetric("min"));

function setMetric(m) {
  metric = m;
  d3.select("#btn-max").classed("active", m === "max");
  d3.select("#btn-min").classed("active", m === "min");
  draw();
}
function monthlyCells() {
  const groups = d3.rollup(
    data,
    // three kinds of date/info that I can show:
    days => ({
      days: days,
      avg: d3.mean(days, d => d[metric]),
      hottest: d3.greatest(days, d => d.max),
      coldest: d3.least(days, d => d.min)
    }),
    d => d.year,
    d => d.month
  );
  const cells = [];
  for (const [year, months] of groups) {
    for (const [month, stats] of months) {
      cells.push({ year, month, ...stats });
    }
  }
  return cells;
}
function formatDate(d) {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
function drawLegend(color, legendX) {
  const [lo, hi] = color.domain();
  // const legendX = margin.left + 21 * cellSize + 30;
  const legendHeight = 200;
 
  const gradient = svg.append("defs").append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", 0).attr("y1", 1).attr("x2", 0).attr("y2", 0);
  d3.range(0, 1.01, 0.1).forEach(t => {
    gradient.append("stop")
      .attr("offset", t)
      .attr("stop-color", color(lo + t * (hi - lo)));
  });
 
  svg.append("rect")
    .attr("x", legendX).attr("y", margin.top)
    .attr("width", 15).attr("height", legendHeight)
    .attr("fill", "url(#legend-gradient)");
 
  const scale = d3.scaleLinear().domain([lo, hi]).range([margin.top + legendHeight, margin.top]);
  svg.append("g")
    .attr("transform", `translate(${legendX + 15},0)`)
    .call(d3.axisRight(scale).ticks(5));

  svg.append("text").attr("x", legendX).attr("y", margin.top - 8).attr("font-size", 12)
    .text(`Avg ${metric} (°C)`);
 
  // Line key
  const keyY = margin.top + legendHeight + 30;
  // svg.append("line").attr("x1", legendX).attr("x2", legendX + 25).attr("y1", keyY).attr("y2", keyY).attr("stroke", "black").attr("stroke-width", 1.2);
  // svg.append("text").attr("x", legendX + 30).attr("y", keyY + 4).attr("font-size", 12).text("Daily max");
  // svg.append("line").attr("x1", legendX).attr("x2", legendX + 25).attr("y1", keyY + 18).attr("y2", keyY + 18).attr("stroke", "black").attr("stroke-width", 1.2).attr("stroke-dasharray", "3,2");
  // svg.append("text").attr("x", legendX + 30).attr("y", keyY + 22).attr("font-size", 12).text("Daily min");
}
function draw() {
  const cells = monthlyCells();
  const years = Array.from(new Set(cells.map(c => c.year))).sort();
  const months = d3.range(1, 13);
 
  svg.attr("width", margin.left + years.length * cellWidth + margin.right)
     .attr("height", margin.top + months.length * cellHeight + margin.bottom);
  svg.selectAll("*").remove();
 
  const x = d3.scaleBand().domain(years).range([margin.left, margin.left + years.length * cellWidth]);
  const y = d3.scaleBand().domain(months).range([margin.top, margin.top + months.length * cellHeight]);
 
  const color = d3.scaleSequential(d3.scaleSequential(t => d3.interpolateYlOrRd(0.05 + t * 0.6)))
    .domain(d3.extent(cells, c => c.avg));  //now the background is lighter and the lines are more visible.
 
  // Inside a cell: day of month -> horizontal, temperature -> vertical.
  // Same vertical scale for every cell so cells can be compared.
  const dayScale = d3.scaleLinear().domain([1, 31]).range([padding, cellWidth - padding]);
  const tempScale = d3.scaleLinear()
    .domain([d3.min(data, d => d.min), d3.max(data, d => d.max)])
    .range([cellHeight - padding, padding]);
 
  const maxLine = d3.line().x(d => dayScale(d.day)).y(d => tempScale(d.max));
  const minLine = d3.line().x(d => dayScale(d.day)).y(d => tempScale(d.min));
 
  const cell = svg.selectAll("g.cell")
    .data(cells)
    .join("g")
    .attr("class", "cell")
    .attr("transform", c => `translate(${x(c.year)},${y(c.month)})`);
 
  cell.append("rect")
    .attr("width", cellWidth - 2)
    .attr("height", cellHeight - 2)
    .attr("fill", c => color(c.avg));
 
  cell.append("path")
    .attr("d", c => maxLine(c.days))
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 1.2);
 
  cell.append("path")
    .attr("d", c => minLine(c.days))
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 1.2)
    .attr("stroke-dasharray", "3,2");
 
  cell
    .on("mousemove", (event, c) => {
      tooltip
        .style("opacity", 1)
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px")
        .html(
          `${c.year}-${String(c.month).padStart(2, "0")}<br>` +
          (metric === "max"
            ? `Highest max: ${c.hottest.max} °C (${formatDate(c.hottest)})`
            : `Lowest min: ${c.coldest.min} °C (${formatDate(c.coldest)})`)
        );
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));
 
  svg.append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(d3.axisTop(x));
 
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(m => d3.timeFormat("%b")(new Date(2000, m - 1))));
 
  drawLegend(color, margin.left + years.length * cellWidth + 30);
}