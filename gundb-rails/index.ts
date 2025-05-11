#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs-extra";
import path from "path";
import inquirer from "inquirer";
import chalk from "chalk";
import { generate, GeneratorOptions } from "./src/core/Generator";
import {  execSync } from "child_process";
import { readTemplateFile } from "./src/utils/templateUtils";
import {
  writeFile,
  writeJsonFile,
  ensureDirectory,
} from "./src/utils/fileUtils";

// Banner del progetto
function printBanner() {
  console.log(
    chalk.bold.cyan(`
 ██████╗ ██╗   ██╗███╗   ██╗██████╗ ██████╗        ██████╗  █████╗ ██╗██╗     ███████╗
██╔════╝ ██║   ██║████╗  ██║██╔══██╗██╔══██╗      ██╔═══██╗██╔══██╗██║██║     ██╔════╝
██║  ███╗██║   ██║██╔██╗ ██║██║  ██║██████╔╝█████╗██████╔╝███████║██║██║     ███████╗
██║   ██║██║   ██║██║╚██╗██║██║  ██║██╔══██╗╚════╝██╔══██╗██╔══██║██║██║     ╚════██║
╚██████╔╝╚██████╔╝██║ ╚████║██████╔╝██████╔╝      ██║  ██║██║  ██║██║███████╗███████║
 ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚═════╝       ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝
                                                                          CON SHOGUN
`)
  );
  console.log(chalk.blue("GunDB Rails Scaffolding + Shogun Integration\n"));
}

// Versione del programma
const version = "1.0.0";

// Inizializza il programma
const program = new Command();

program
  .version(version)
  .description(
    "Generatore di scaffold per GunDB e NextJS con integrazione Shogun e supporto ActiveRecord"
  );

program
  .command("generate <model> [fields...]")
  .alias("g")
  .description(
    'Genera un modello Gun e relativo scaffold (es: "generate User name:string age:number email:string")'
  )
  .option("--nextjs", "Genera integrazione con NextJS")
  .option("--hardhat", "Genera integrazione con Hardhat")
  .option("-d, --output-dir <path>", "Directory di output per le integrazioni")
  .option("-r, --relation <relation>", "Aggiungi una relazione (es: hasMany:Auto:autos, belongsTo:User:owner)", (val: string, relations: string[]) => {
    relations.push(val);
    return relations;
  }, [] as string[])
  .option("--use-base-model", "Usa la classe base Model per le relazioni automatiche in stile ActiveRecord", false)
  .action(async (model, fields, options) => {
    console.log(
      chalk.green(`🚀 Generazione del modello ${chalk.bold(model)} in corso...`)
    );

    try {
      const genOptions: GeneratorOptions = {
        nextjs: options.nextjs,
        hardhat: options.hardhat,
        outputDir: options.outputDir,
        useBaseModel: options.useBaseModel
      };

      await generate(model, fields, options.relation, genOptions);
      
      // Mostra messaggio informativo sulle relazioni
      if (options.relation && options.relation.length > 0) {
        console.log(chalk.blue("\n💡 Relazioni definite:"));
        options.relation.forEach((rel: string) => {
          console.log(chalk.green(`  ✓ ${rel}`));
        });
        console.log(chalk.yellow("\nSintassi delle relazioni:"));
        console.log("  - user.posts.add(post)    // Aggiunge post a user");
        console.log("  - user.posts.all()        // Ottiene tutti i post dell'utente");
        console.log("  - user.posts.create({...}) // Crea e collega un nuovo post");
        console.log("  - post.author.get()       // Ottiene l'autore del post");
      }
      
      console.log(chalk.green("\n✅ Generazione completata con successo!"));
    } catch (error: any) {
      console.error(
        chalk.red("❌ Errore durante la generazione:"),
        error.message
      );
      process.exit(1);
    }
  });

program
  .command("shogun-init")
  .description("Inizializza un progetto Shogun con GunDB")
  .action(async () => {
    printBanner();
    console.log(
      chalk.green("📦 Inizializzazione progetto Shogun con GunDB...")
    );

    try {
      const { projectName } = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "Nome del progetto:",
          default: "shogun-app",
        },
      ]);

      // Crea directory del progetto
      const projectDir = path.resolve(process.cwd(), projectName);
      await ensureDirectory(projectDir);
      console.log(chalk.blue(`📁 Directory ${projectDir} creata`));

      // Clona scaffold-eth-2
      console.log(chalk.blue("🔄 Clonazione di scaffold-eth-2..."));
      execSync(
        `git clone https://github.com/scaffold-eth/scaffold-eth-2.git ${projectDir}`,
        { stdio: "inherit" }
      );

      // Crea directory gundb
      const gundbDir = path.join(projectDir, "packages/gundb");
      await ensureDirectory(gundbDir);
      console.log(chalk.blue("📁 Directory packages/gundb creata"));

      // Crea package.json per gundb
      const gundbPackageJson = {
        name: "@se-2/gundb",
        version: "1.0.0",
        private: true,
        description: "GunDB integration package with Shogun",
        license: "MIT",
        type: "commonjs",
        scripts: {
          relay: "node server.js",
        },
        dependencies: {
          gun: "latest",
          "shogun-core": "latest",
          express: "^4.18.2",
          cors: "^2.8.5",
        },
      };

      await writeJsonFile(
        path.join(gundbDir, "package.json"),
        gundbPackageJson
      );
      console.log(chalk.blue("📄 package.json per gundb creato"));

      const nextjsPackageJson = {
        dependencies: {
          "shogun-core": "latest",
        },
      };

      const nextjsDir = path.join(projectDir, "packages/nextjs");
      await ensureDirectory(nextjsDir);
      console.log(chalk.blue("📁 Directory packages/nextjs creata"));

      const nextJsPackageJson = readTemplateFile("nextjs.package.json.template");
      await writeFile(path.join(nextjsDir, "package.json"), nextJsPackageJson);
      console.log(chalk.blue("📄 Pagina index.html per relay creata"));
      
      // Crea server.js per il relay gundb
      const serverTemplate = readTemplateFile("server.js.template");
      await writeFile(path.join(gundbDir, "server.js"), serverTemplate);
      console.log(chalk.blue("📄 server.js per relay GunDB creato"));

      // Crea directory public per il relay
      const publicDir = path.join(gundbDir, "public");
      await ensureDirectory(publicDir);

      // Crea index.html per il relay
      const indexHtmlTemplate = readTemplateFile("index.html.template");
      await writeFile(path.join(publicDir, "index.html"), indexHtmlTemplate);
      console.log(chalk.blue("📄 Pagina index.html per relay creata"));

      // Aggiorna root package.json per includere gundb
      const rootPackageJsonPath = path.join(projectDir, "package.json");
      const rootPackageJson = await fs.readJSON(rootPackageJsonPath);

      // Aggiungi gundb al workspace
      if (!rootPackageJson.workspaces.packages.includes("packages/gundb")) {
        rootPackageJson.workspaces.packages.push("packages/gundb");
      }

      // Aggiungi script per avviare il relay
      rootPackageJson.scripts["gun:relay"] = "yarn workspace @se-2/gundb relay";
      rootPackageJson.scripts["start:with-relay"] =
        'concurrently "yarn gun:relay" "yarn start"';

      // Aggiungi concurrently come dev dependency
      if (!rootPackageJson.devDependencies.concurrently) {
        rootPackageJson.devDependencies.concurrently = "^8.2.0";
      }

      await writeJsonFile(rootPackageJsonPath, rootPackageJson);
      console.log(chalk.blue("📄 Root package.json aggiornato"));

      // Crea ShogunGunProvider.tsx
      const shogunDir = path.join(
        projectDir,
        "packages/nextjs/components/shogun"
      );
      await ensureDirectory(shogunDir);

      // Leggi e scrivi i template
      const shogunGunProviderTemplate = readTemplateFile(
        "ShogunGunProvider.tsx.template"
      );
      await writeFile(
        path.join(shogunDir, "ShogunGunProvider.tsx"),
        shogunGunProviderTemplate
      );
      console.log(chalk.blue("📄 ShogunGunProvider.tsx creato"));

      // Crea ShogunProviders.tsx
      const shogunProvidersTemplate = readTemplateFile(
        "ShogunProviders.tsx.template"
      );
      await writeFile(
        path.join(shogunDir, "ShogunProviders.tsx"),
        shogunProvidersTemplate
      );
      console.log(chalk.blue("📄 ShogunProviders.tsx creato"));

      // Crea shogun page
      const appDir = path.join(projectDir, "packages/nextjs/app");
      const appShogunDir = path.join(appDir, "shogun");
      await ensureDirectory(appShogunDir);

      const shogunPageTemplate = readTemplateFile("shogunPage.tsx.template");
      await writeFile(path.join(appShogunDir, "page.tsx"), shogunPageTemplate);
      console.log(chalk.blue("📄 shogun/page.tsx creato"));

      // Crea layout.tsx
      const layoutPageTemplate = readTemplateFile("layout.tsx.template");
      await writeFile(path.join(appDir, "layout.tsx"), layoutPageTemplate);
      console.log(chalk.blue("📄 layout.tsx creato"));

      console.log(
        chalk.green("\n✅ Inizializzazione completata con successo!")
      );
      console.log(chalk.blue("\nProssimi passi:"));
      console.log(chalk.yellow(`1. cd ${projectName}`));
      console.log(chalk.yellow("2. yarn install"));
      console.log(
        chalk.yellow(
          "3. yarn gun:relay               # Per avviare solo il GunDB relay"
        )
      );
      console.log(
        chalk.yellow(
          "4. yarn start                   # In un altro terminale per avviare Next.js"
        )
      );
      console.log(
        chalk.yellow(
          "5. yarn start:with-relay        # Oppure usa questo per avviare entrambi insieme"
        )
      );
      console.log(
        chalk.yellow(
          "6. Naviga a http://localhost:3000/shogun per vedere la pagina di autenticazione"
        )
      );
    } catch (error: any) {
      console.error(
        chalk.red("❌ Errore durante l'inizializzazione:"),
        error.message
      );
      process.exit(1);
    }
  });

program
  .command("model")
  .description("Gestisci i modelli Gun")
  .action(() => {
    printBanner();
    console.log(
      chalk.yellow("Comandi disponibili per la gestione dei modelli:")
    );
    console.log(
      chalk.blue("  generate <model> [fields...]    # Genera un nuovo modello")
    );
    console.log(
      "\nEsempio base: gundb-rails generate User name:string email:string"
    );
    console.log(
      "\nEsempio con relazioni:\n" +
      "  gundb-rails generate User name:string \\\n" +
      "    --relation hasMany:Post:posts \\\n" +
      "    --relation belongsTo:Company:employer \\\n" +
      "    --use-base-model"
    );
    console.log("\nTipi di relazioni supportati:");
    console.log("  - hasMany:      Relazione uno-a-molti (es. utente -> post)");
    console.log("  - belongsTo:    Relazione di appartenenza (es. post -> utente)");
    console.log("  - hasOne:       Relazione uno-a-uno (es. utente -> profilo)");
  });

program
  .command("relations")
  .description("Mostra esempi di utilizzo delle relazioni")
  .action(() => {
    printBanner();
    console.log(
      chalk.yellow("Esempi di utilizzo delle relazioni in stile ActiveRecord:")
    );
    console.log("\nDefinizione dei modelli:");
    console.log(chalk.green("// Modello User con relazione hasMany a Post"));
    console.log("User.hasMany('Post', { as: 'posts' });\n");
    console.log(chalk.green("// Modello Post con relazione belongsTo a User"));
    console.log("Post.belongsTo('User', { as: 'author' });\n");

    console.log("\nUtilizzo delle relazioni:");
    console.log(chalk.green("// Aggiungere un post a un utente"));
    console.log("await user.posts.add(post);\n");
    console.log(chalk.green("// Ottenere tutti i post di un utente"));
    console.log("const posts = await user.posts.all();\n");
    console.log(chalk.green("// Creare un nuovo post collegato all'utente"));
    console.log("const newPost = await user.posts.create({ title: 'Nuovo post' });\n");
    console.log(chalk.green("// Impostare l'autore di un post"));
    console.log("await post.author.set(user);\n");
    console.log(chalk.green("// Ottenere l'autore di un post"));
    console.log("const author = await post.author.get();\n");
    console.log(chalk.green("// Filtrare i post di un utente"));
    console.log("const filteredPosts = await user.posts.where({ title: 'Titolo' });\n");
    console.log(chalk.green("// Verificare se un utente ha post"));
    console.log("const hasPosts = await user.posts.exists();\n");
    console.log(chalk.green("// Rimuovere un post da un utente"));
    console.log("await user.posts.remove(post);");
  });

// Gestisci il caso in cui non vengono forniti argomenti
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  printBanner();
  program.outputHelp();
}
