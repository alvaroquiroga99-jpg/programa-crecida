const fs = require("fs");

const sourcePath = "departamentos-argentina.geojson";
const outputPath = "map-data.js";
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const tucumanFeatures = source.features.filter((feature) => {
  const province = feature.properties && feature.properties.provincia;
  return province && (province.id === "90" || /tucum/i.test(province.nombre || ""));
});

let minLon = Infinity;
let minLat = Infinity;
let maxLon = -Infinity;
let maxLat = -Infinity;

function walkCoordinates(coordinates, visitor) {
  if (typeof coordinates[0] === "number") {
    visitor(coordinates);
    return;
  }

  coordinates.forEach((item) => walkCoordinates(item, visitor));
}

tucumanFeatures.forEach((feature) => {
  walkCoordinates(feature.geometry.coordinates, ([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
});

const width = 460;
const height = 640;
const padding = 22;

function project([lon, lat]) {
  const x = padding + ((lon - minLon) / (maxLon - minLon)) * (width - padding * 2);
  const y = padding + ((maxLat - lat) / (maxLat - minLat)) * (height - padding * 2);
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx || dy) {
    let t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplify(points, tolerance = 1.1) {
  if (points.length <= 4) {
    return points;
  }

  const squaredTolerance = tolerance * tolerance;

  function step(first, last, output) {
    let maxDistance = squaredTolerance;
    let index = -1;

    for (let i = first + 1; i < last; i += 1) {
      const distance = squaredSegmentDistance(points[i], points[first], points[last]);

      if (distance > maxDistance) {
        index = i;
        maxDistance = distance;
      }
    }

    if (index !== -1) {
      if (index - first > 1) {
        step(first, index, output);
      }

      output.push(points[index]);

      if (last - index > 1) {
        step(index, last, output);
      }
    }
  }

  const output = [points[0]];
  step(0, points.length - 1, output);
  output.push(points[points.length - 1]);
  return output;
}

function ringToPath(ring) {
  const points = simplify(ring.map(project));
  return `${points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ")} Z`;
}

function geometryToPath(geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringToPath).join(" ");
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) => polygon.map(ringToPath)).join(" ");
  }

  return "";
}

const departments = tucumanFeatures
  .map((feature) => ({
    id: feature.properties.id,
    name: feature.properties.nombre,
    path: geometryToPath(feature.geometry),
    centroid: project([feature.properties.centroide.lon, feature.properties.centroide.lat]),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

fs.writeFileSync(
  outputPath,
  `window.TUCUMAN_DEPARTMENTS = ${JSON.stringify(departments, null, 2)};\n`,
);

console.log(`Generated ${outputPath} with ${departments.length} Tucuman departments.`);
