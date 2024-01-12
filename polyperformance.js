const puppeteer = require('puppeteer');
const fs = require('fs');
const { exec } = require('child_process');
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const get_brands = require('./src/get_brand');
const get_product_metadata = require('./src/get_product_metadata');
const get_product_details = require('./src/get_product_details');

(async () => {
    await get_brands();
    await get_product_metadata();
    await get_product_details();
})();