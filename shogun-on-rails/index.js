const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { exec } = require("child_process");

const directories = [
  "backend/controllers",
  "backend/models",
  "backend/routes",
  "backend/services",
  "backend/config",
  "backend/middleware",
  "frontend/src/components",
  "frontend/src/router",
  "contracts",
];

console.log(
  "\x1b[1m Hey! I am the NEVM MVC Scaffolding Tool you've been searching for!\x1b[0m"
);
console.log();
console.log(
  "\x1b[1m Let's get started on your nodejs app development journey with everything you need to work in peace with a clean MVC structure and a little extra magic... \x1b[0m"
);
console.log();
console.log();
console.log(
  "\x1b[1m Setting up the scaffolding for the tower you are going to build \x1b[0m"
);
console.log();
function showDivider(character, length) {
  console.log(character.repeat(length));
  console.log();
}

showDivider("-", 40);
directories.forEach((directory) => {
  const directoryPath = path.join(process.cwd(), directory);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log(`Created directory: ${directoryPath}`);
  } else {
    console.log(`Directory already exists: ${directoryPath}`);
  }
});

showDivider("-", 40);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Do you want to install Express.js? (y/n): ", (answer) => {
  if (answer.toLowerCase() === "y") {
    console.log("Installing Express.js...");
    exec("npm install express", (error, stdout, stderr) => {
      if (error) {
        console.error(`Error installing Express.js: ${error}`);
        return;
      }
      console.log(stdout);
      console.log("Express.js installed successfully.");
      generateServerFile();
    });
  } else {
    console.log("Skipping installation of Express.js.");
    generateServerFile();
  }
});

function generateServerFile() {
  showDivider("-", 40);
  const serverFile = path.join(process.cwd(), "server.js");
  const serverContent = `
const express = require('express');
const app = express();

// Set up middleware, routes, and other configurations here

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(\`Server is running on port \${PORT}\`);
});
`;

  fs.writeFile(serverFile, serverContent, (err) => {
    if (err) {
      console.error("Error generating server.js file:", err);
      return;
    }
    console.log("Server file (server.js) generated successfully.");
    installORM();
  });
}

function installORM() {
  showDivider("-", 40);
  rl.question(
    "Do you want to install an ORM? (sequelize(s)/mongoose(m)/both(b)/neither(n)): ",
    (answer) => {
      if (
        answer.toLowerCase() === "sequelize" ||
        answer.toLowerCase() === "s"
      ) {
        installSequelize();
      } else if (
        answer.toLowerCase() === "mongoose" ||
        answer.toLowerCase() === "m"
      ) {
        installMongoose();
      } else if (
        answer.toLowerCase() === "both" ||
        answer.toLowerCase() === "b"
      ) {
        installSequelize(() => installMongoose(frontendChoice));
      } else {
        console.log("Skipping installation of ORM.");
        console.log("Next steps:");
        console.log(
          "- Define your models and database configurations as needed."
        );
        frontendChoice();
      }
    }
  );
}

function installSequelize(callback) {
  showDivider("-", 40);
  console.log("Installing Sequelize...");
  exec("npm install sequelize sqlite3", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing Sequelize: ${error}`);
      if (callback) callback();
      return;
    }
    console.log(stdout);
    console.log("Sequelize and SQLite installed successfully.");
    if (callback) callback();
    else frontendChoice();
  });
}

function installMongoose(callback) {
  showDivider("-", 40);
  console.log("Installing Mongoose...");
  exec("npm install mongoose", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing Mongoose: ${error}`);
      if (callback) callback();
      return;
    }
    console.log(stdout);
    console.log("Mongoose installed successfully.");
    if (callback) callback();
    else frontendChoice();
  });
}

function frontendChoice() {
  showDivider("-", 40);
  rl.question(
    "Choose a frontend framework (vue/svelte/alpine/none): ",
    (answer) => {
      const choice = answer.toLowerCase();
      if (choice === "vue") installVue();
      else if (choice === "svelte") installSvelte();
      else if (choice === "alpine") installAlpine();
      else {
        console.log("Skipping frontend setup.");
        installHardhat();
      }
    }
  );
}

function installVue() {
  const frontEndDirectory = "frontend";
  const frontEnd = path.join(process.cwd(), frontEndDirectory);

  console.log("Installing Vue.js with Vite...");
  const installCommand =
    "cd frontend && npm init -y && npm install vue vite @vitejs/plugin-vue";
  exec(installCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing Vue.js with Vite: ${error}`);
      return;
    }
    console.log(stdout);
    console.log("Vue.js with Vite installed successfully.");
    updateFrontendVue();
  });
}

function updateFrontendVue() {
  showDivider("-", 40);
  const frontendPackageJsonPath = path.join(
    process.cwd(),
    "frontend",
    "package.json"
  );
  if (!fs.existsSync(frontendPackageJsonPath)) {
    console.log("Frontend package.json not found, skipping script updates.");
    installHardhat();
    return;
  }
  const frontendPackageJson = require(frontendPackageJsonPath);
  frontendPackageJson.scripts.dev = "vite";
  frontendPackageJson.scripts.build = "vite build";
  fs.writeFileSync(
    frontendPackageJsonPath,
    JSON.stringify(frontendPackageJson, null, 2)
  );

  const routerDirectory = path.join(process.cwd(), "frontend", "src", "router");
  if (!fs.existsSync(routerDirectory)) {
    fs.mkdirSync(routerDirectory, { recursive: true });
    console.log(`Created directory: ${routerDirectory}`);
  }

  exec("cd frontend && npm install vue-router", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing Vue Router: ${error}`);
      return;
    }
    console.log(stdout);
    console.log("Vue Router installed successfully.");

    const routerFile = path.join(routerDirectory, "router.js");
    const routerContent = `
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  // Define your routes here
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
        `;

    fs.writeFile(routerFile, routerContent, (err) => {
      if (err) {
        console.error("Error generating router.js file:", err);
        return;
      }
      console.log("Router file (router.js) generated successfully.");
      installHardhat();
    });
  });
}

function installSvelte() {
  console.log("Creating Svelte project...");
  const command = "npm create svelte@latest frontend -- --yes";
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error creating Svelte project: ${error}`);
      return;
    }
    console.log(stdout);
    exec("cd frontend && npm install", (err, out, errout) => {
      if (err) {
        console.error(`Error running npm install for Svelte: ${err}`);
        return;
      }
      console.log("Svelte project set up successfully.");
      installHardhat();
    });
  });
}

function installAlpine() {
  const frontEndDir = path.join(process.cwd(), "frontend");
  const indexHtml = path.join(frontEndDir, "index.html");

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AlpineJS App</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body>
  <div x-data="{ count: 0 }">
    <button @click="count++">Increment</button>
    <span x-text="count"></span>
  </div>
</body>
</html>
    `;

  fs.writeFileSync(indexHtml, htmlContent.trim());
  console.log("Created frontend/index.html with Alpine.js setup.");
  installHardhat();
}

function installHardhat() {
  showDivider("-", 40);
  rl.question(
    "Do you want to install Hardhat for smart contract development? (y/n): ",
    (answer) => {
      if (answer.toLowerCase() === "y") {
        console.log("Installing Hardhat...");
        exec(
          "npm install --save-dev hardhat && npx hardhat",
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error installing Hardhat: ${error}`);
              rl.close();
              return;
            }
            console.log(stdout);
            console.log("Hardhat installed and initialized successfully.");
            rl.close();
          }
        );
      } else {
        console.log("Skipping Hardhat installation.");
        rl.close();
      }
    }
  );
}
