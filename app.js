const express = require("express");
const hbs = require("hbs");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const createService = require("./service");

const app = express();
const PORT = 3000;

const CONFIG = process.argv[2] || "config.yaml";
const configPath = path.resolve(__dirname, CONFIG);

let config;

try {
  config = yaml.load(fs.readFileSync(configPath, "utf8"));

  if (!config || !Array.isArray(config.routes)) {
    throw new Error("Config must contain a routes array");
  }
} catch (error) {
  console.error("Error reading or parsing config:", error);
  process.exit(1);
}

const service = createService(config);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); //HTML <form> request
app.set('view engine','hbs');
hbs.registerHelper("equal", (a, b) => a === b);

function getRedirectUrl(req) {
  let url = `/${req.params.route}`;
  if (req.params.route == "pets"){
    url += `?embed=owners`;
  }
  return url;
}

app.get("/", (req, res) => {
  res.render("index", { routes: config.routes });
});

app.get("/:route", (req, res) => {
  const route = req.params.route;
  const embed = route === "pets" ? req.query.embed : undefined;
  res.render("list", {
    items: service.getAll(route, embed),
    route
  });
});

app.get("/:route/add", (req, res) => {
  const route = req.params.route;
  const isPets = route === "pets";
  res.render("add", {
    route,
    isPets,
    persons: isPets ? service.getAll("persons") : []
  });
});

app.get("/:route/:id", (req, res) => {
  const { route, id } = req.params;
  const item = service.getById(route, id);
  res.json(item);
});

app.get("/:route/update/:id", (req, res) => {
  const { route, id } = req.params;
  const isPets = route === "pets";
  const item = service.getAll(route).find(i => String(i.id) === id);

  res.render("update", {
    route,
    item,
    isPets,
    persons: isPets ? service.getAll("persons") : []
  });
});



app.post("/:route", (req, res) => {
  service.add(req.params.route, req.body);

  res.redirect(getRedirectUrl(req));
});

app.post("/:route/update/:id", (req, res) => {
  service.update(req.params.route, req.params.id, req.body);
  
  res.redirect(getRedirectUrl(req));
});

app.post("/:route/delete/:id", (req, res) => {
  service.remove(req.params.route, req.params.id);

  res.redirect(getRedirectUrl(req));
});

// Foutafhandeling moet na de routes staan.
app.use((error, req, res, next) => {
  const status = error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error: status >= 500
      ? "Internal server error"
      : error.message,
  });
});

function saveConfig() {
  fs.writeFileSync(configPath, yaml.dump(config), "utf8");
}

const server = app
  .listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  })
  .on("error", error => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log("Shutting down...");

  server.close(() => {
    try {
      saveConfig();
      console.log("Config saved");
      process.exit(0);
    } catch (error) {
      console.error("Error saving config:", error);
      process.exit(1);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);