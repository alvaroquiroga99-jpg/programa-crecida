const fs = require("fs");
const path = require("path");

const project = process.env.FIREBASE_PROJECT_ID || "programa-crecida-dgime";
const configPath = path.join(process.env.USERPROFILE, ".config", "configstore", "firebase-tools.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const token = config.tokens?.access_token;

if (!token) {
  throw new Error("No Firebase access token found. Run firebase login first.");
}

const services = [
  "firestore.googleapis.com",
  "cloudfunctions.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "run.googleapis.com",
  "eventarc.googleapis.com",
];

async function main() {
  for (const service of services) {
    const response = await fetch(`https://serviceusage.googleapis.com/v1/projects/${project}/services/${service}:enable`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    const text = await response.text();
    console.log(`${service}: ${response.status}`);
    if (!response.ok && !text.includes("already enabled")) {
      console.log(text.slice(0, 500));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
