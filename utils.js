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

async function get_progress() {
  let progress = {
    brands: 0.0,
    metadata: 0.0,
    details: 0.0,
  };

  // get brands process
  let numberofbrands = 0;
  if (fs.existsSync(`./assets/brands.json`)) {
    numberofbrands = JSON.parse(
      fs.readFileSync("./assets/brands.json", "utf8")
    ).length;

    progress["brands"] =
      (JSON.parse(fs.readFileSync("./assets/tree.json", "utf8")).length /
        JSON.parse(fs.readFileSync("./assets/categories.json", "utf8"))
          .length) *
      100;
  } else {
    return progress;
  }

  // get metadata process
  if (fs.existsSync(`./assets/metadata.json`)) {
    console.log(
      JSON.parse(fs.readFileSync("./assets/metadata.json", "utf8")).length,
      numberofbrands
    );
    progress["metadata"] =
      (JSON.parse(fs.readFileSync("./assets/metadata.json", "utf8")).length /
        numberofbrands) *
      100;
  } else {
    return progress;
  }

  // get details process
  if (fs.existsSync(`./assets/data`) && progress["metadata"] == 100.0)
    progress["details"] =
      (fs.readdirSync("./assets/data").length / numberofbrands) * 100;

  return progress;
}
(async () => {
  const process = await get_progress();
  console.log(process);
})();

module.exports = get_progress;
