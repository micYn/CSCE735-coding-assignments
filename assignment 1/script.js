const margin = { top: 40, right: 100, bottom: 20, left: 50};
const cellSize = 40;

const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");

let data = [];
let metric = "max";

d3.csv("temperature_daily.csv").then(rows => {
  data = rows.map(r => {
    const [year, month, day] = r.date.split("-").map(Number);
    return { year, month, day, max: +r.max_temperature, min: +r.min_temperature };
  });
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

function monthlyAverages() {
  const groups = d3.rollup(
    data,
    days => d3.mean(days, d => d[metric]),
    d => d.year,
    d => d.month
  );
  const cells = [];
  for (const [year, months] of groups) {
    for (const [month, avg] of months) {
      cells.push({ year, month, avg });
    }
  }
  return cells;
}
function drawLegend(color) {
  const [lo, hi] = color.domain();
  const legendX = margin.left + 21 * cellSize + 30;
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
}

function draw() {
  const cells = monthlyAverages();
  const years = Array.from(new Set(cells.map(c => c.year))).sort();
  const months = d3.range(1, 13);

  svg.attr("width", margin.left + years.length * cellSize + margin.right)
     .attr("height", margin.top + months.length * cellSize + margin.bottom);
  svg.selectAll("*").remove();

  const x = d3.scaleBand().domain(years).range([margin.left, margin.left + years.length * cellSize]);
  const y = d3.scaleBand().domain(months).range([margin.top, margin.top + months.length * cellSize]);

  const color = d3.scaleSequential(d3.interpolateYlOrRd)
    .domain(d3.extent(cells, c => c.avg));

  svg.selectAll("rect")
    .data(cells)
    .join("rect")
    .attr("x", c => x(c.year))
    .attr("y", c => y(c.month))
    .attr("width", x.bandwidth() - 1)
    .attr("height", y.bandwidth() - 1)
    .attr("fill", c => color(c.avg))
    .on("mousemove", (event, c) => {
      tooltip
        .style("opacity", 1)
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px")
        .html(`${c.year}-${String(c.month).padStart(2, "0")}<br>Average ${metric}: ${c.avg.toFixed(1)} °C`);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  svg.append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(d3.axisTop(x).tickValues(years.filter(yr => yr % 2 === 1)));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(m => d3.timeFormat("%b")(new Date(2000, m - 1))));

  drawLegend(color);
}