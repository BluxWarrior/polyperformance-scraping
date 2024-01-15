const fs = require('fs');
const path = require('path');
const Papa = require('papaparse'); // Including papaparse for CSV operations
const JSZip = require('jszip');

function getNewData(data) {
  const producturls = data.map(x => x['url']);

  const new_data = [];
  for (let dt of data) {
    let new_options = dt['options'];
    if (new_options.length > 1) {
      new_options = new_options.slice(1);
    }

    if (dt['url'] !== dt['parent_url'] && dt['parent_url'] !== '') {
      console.log('not matched parent    ', dt['url']);
      try {
        const id = producturls.indexOf(dt['parent_url']);
        new_data.push({
          'options': new_options,
          'brand': dt['brand'],
          'name': data[id]['name'],
          'url': dt['url'],
          'description': dt['description']
        });
      } catch (error) {
        console.log('------- error');
        new_data.push({
          'options': new_options,
          'brand': dt['brand'],
          'name': dt['name'],
          'url': dt['url'],
          'description': dt['description']
        });
      }
    } else {
      new_data.push({
        'options': new_options,
        'brand': dt['brand'],
        'name': dt['name'],
        'url': dt['url'],
        'description': dt['description']
      });
    }
  }

  return new_data;
}

function removeDuplicatedData(data) {
  const skus = {};
  const new_data = [];

  for (let dt of data) {
    skus[dt['name']] = [];
  }

  for (let dt of data) {
    const new_options = dt['options'].filter(op => {
      if (!skus[dt['name']].includes(op['skuNumber'])) {
        skus[dt['name']].push(op['skuNumber']);
        return true;
      }
      return false;
    });

    if (new_options.length > 0) {
      new_data.push({
        'options': new_options,
        'brand': dt['brand'],
        'name': dt['name'],
        'url': dt['url'],
        'description': dt['description']
      });
    }
  }

  return new_data;
}

function refactor(data) {
  let refactoredData = [];
  let count = 0;

  data.forEach(dt => {
    const handle = dt.url.split('https://www.polyperformance.com/')[1];
    const title = dt.name;
    const body = dt.description;
    const vendor = dt.brand;

    dt.options.forEach((option, oid) => {
      const skunumber = option.skuNumber;
      let finalprice = option.finalprice;
      let oldprice = option.oldprice || "0";

      let num_finalprice = parseFloat(finalprice.replace(/,/g, ""));
      let num_oldprice = parseFloat(oldprice.replace(/,/g, ""));
      if (isNaN(num_finalprice)) num_finalprice = 0;

      if (num_oldprice > num_finalprice * 1.7) {
        oldprice = finalprice;
        count++;
      }
      if (num_oldprice === 0 || num_oldprice < num_finalprice) {
        oldprice = finalprice;
      }
      const optionname = option.skuNumber;

      option.images.forEach((img, i) => {
        let tempPd = {
          Handle: handle,
          Title: title,
          "Body (HTML)": body,
          Vendor: vendor,
          "Product Category": "Vehicles & Parts > Vehicle Parts & Accessories",
          "Type": "",
          "Tags": "",
          "Published": "",
          "Option1 Name": "Part #",
          "Option1 Value": optionname,
          "Variant SKU": skunumber,
          "Variant Price": finalprice,
          "Variant Compare At Price": oldprice,
          "Variant Requires Shipping": "TRUE",
          "Variant Taxable": "TRUE",
          "Variant Barcode": "",
          "Image Src": img,
          "Image Position": i + 1,
          "Image Alt Text": "",
          "Gift Card": "",
          "SEO Title": "",
          "SEO Description": "",
          "Google Shopping / Google Product Category": "",
          "Google Shopping / Gender": "",
          "Google Shopping / Age Group": "",
          "Google Shopping / MPN": "",
          "Google Shopping / Condition": "",
          "Google Shopping / Custom Product": "",
          "Google Shopping / Custom Label 0": "",
          "Google Shopping / Custom Label 1": "",
          "Google Shopping / Custom Label 2": "",
          "Google Shopping / Custom Label 3": "",
          "Google Shopping / Custom Label 4": "",
          "Variant Image": "",
          "Variant Weight Unit": "",
          "Variant Tax Code": "",
          "Cost per item": "",
          "Included / United States": "",
          "Price / United States": "",
          "Compare At Price / United States": "",
          "Included / International": "",
          "Price / International": "",
          "Compare At Price / International": "",
          "Status": ""
        };

        // options logic
        if (optionname === "original" || dt.options.length === 1 || oid !== 0 || i !== 0) {
          tempPd['Option1 Name'] = "";
          tempPd['Option1 Value'] = "";
        }

        if (oid !== 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
        }

        if (i !== 0) {
          tempPd["Variant SKU"] = "";
          tempPd["Variant Price"] = "";
          tempPd["Variant Compare At Price"] = "";
          tempPd["Product Category"] = ""
          tempPd["Variant Requires Shipping"] = ""
          tempPd["Variant Taxable"] = ""
        }

        refactoredData.push(tempPd);
      });
    });
  });

  console.log(count);
  return refactoredData;
}

function convertToCSV(data, outputPath) {
  // Here you would implement or use a library to write the CSV.
  // Since papaparse is a popular choice, this example will use it.

  const csv = Papa.unparse(data);
  fs.writeFileSync(outputPath, csv, 'utf8');
  console.log(`The JSON data has been successfully converted to '${outputPath}'.`);
}

function zipFile(filePath, outputZipPath, compressionLevel = 'DEFLATE') {
  const zip = new JSZip();
  const fileName = path.basename(filePath);

  fs.readFile(filePath, function (err, data) {
    if (err) throw err;

    // Add the file to the zip
    zip.file(fileName, data, { compression: compressionLevel });

    // Generate the zip file as a buffer
    zip.generateAsync({ type: 'nodebuffer', compression: compressionLevel }).then(function (content) {
      // Write zip file to disk
      fs.writeFile(outputZipPath, content, function (err) {
        if (err) throw err;
        console.log(`Zipped file saved to ${outputZipPath}`);
      });
    });
  });
}

async function getCSV() {
  const brands = JSON.parse(fs.readFileSync("./assets/brands.json", "utf8"));
  let data = [];
  for (let bd of brands) {
    const brandData = JSON.parse(fs.readFileSync(`./assets/data/${bd['name']}.json`, "utf8"));
    data = data.concat(brandData);
  }

  const newData = getNewData(data);
  const removedData = removeDuplicatedData(newData);
  const refactoredData = refactor(removedData);
  convertToCSV(refactoredData, './assets/output.csv');
  zipFile('./assets/output.csv', './assets/output.zip')
}

getCSV().catch(console.error);