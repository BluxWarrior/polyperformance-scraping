const { exec } = require("child_process");
const fs = require("fs");

async function taskkill(processname) {
  exec(`ps aux | grep "${processname}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }

    // Process the stdout to find the PID
    const processes = stdout
      .split("\n")
      .filter((line) => line.includes(`node ${processname}`));

    // Eliminate the grep process from the results
    const nodeProcesses = processes.filter((line) => !line.includes("grep"));

    for (const process of nodeProcesses) {
      // Split the process line into its components
      const parts = process.trim().split(/\s+/);
      // Assuming PID is at position 1 (ps aux typical result)
      const pid = parts[1];
      const command = parts.slice(10).join(" "); // Command starts at position 10 (may vary based on your 'ps' output)

      console.log(`Found process with PID: ${pid} Command: ${command}`);

      exec(`kill -9 ${pid}`);
    }
  });
}

async function count_files(dir) {
  let count = 0;
  const subdirs = fs.readdirSync(dir);

  for (const sd of subdirs) {
    const fullPath = `${dir}/${sd}`;
    if (fs.statSync(fullPath).isFile()) {
      count += 1;
    } else {
      count += fs.readdirSync(fullPath).length;
    }
  }

  return count;
}

async function clean_file(file) {
  if (!file["completed"]) {
    file["completed"] = true;

    let data = [];
    for (const subcat of categories["data"]) data = data.concat(subcat);
    file["data"] = data;

    const jsonContent = JSON.stringify(file, null, 2);

    fs.writeFileSync("./assets/metadata.json", jsonContent, "utf8", (err) => {
      if (err) {
        console.error("An error occurred:", err);
        return;
      }
      console.log("JSON file has been saved.");
    });
  }
}

async function clean_dir(dir) {
  const subdirs = fs.readdirSync(dir);

  for (const sd of subdirs) {
    const fullPath = `${dir}/${sd}`;
    if (!fs.statSync(fullPath).isFile()) {
      const files = fs.readdirSync(fullPath);

      for (const f of files) {
        fs.renameSync(`${fullPath}/${f}`, `${dir}/${f}`);
      }
      fs.rmdirSync(fullPath);
    }
  }
}

async function get_progress() {
  let progress = {
    brands: 0.0,
    metadata: 0.0,
    details: 0.0,
  };

  // get brands process
  let numberofbrands = 0;
  if (fs.existsSync(`./assets/brands.json`)) {
    progress["brands"] = 100.0;
    numberofbrands = JSON.parse(
      fs.readFileSync("./assets/brands.json", "utf8")
    ).length;
  } else {
    return progress;
  }

  // get metadata process
  let metadata = undefined;
  if (fs.existsSync(`./assets/metadata.json`)) {
    metadata = JSON.parse(fs.readFileSync("./assets/metadata.json", "utf8"));
    if (metadata["completed"])
      progress["metadata"] = (metadata["data"].length / numberofbrands) * 100;
    else {
      let count = 0;
      for (const subcat of metadata["data"]) count += subcat.length;
      progress["metadata"] = (count / numberofbrands) * 100;
      return progress;
    }
  } else {
    return progress;
  }

  // get details process
  if (fs.existsSync(`./assets/data`) && progress["metadata"] == 100.0) {
    await clean_file(metadata);
    progress["details"] =
      ((await count_files("./assets/data")) / numberofbrands) * 100;
  }

  return progress;
}
(async () => {
  const process = await get_progress();
  console.log(process);
})();
