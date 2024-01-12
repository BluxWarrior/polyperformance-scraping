import os
import json
import pandas as pd
import csv

filenames = os.listdir("./assets/data")

def get_new_data(data):
    producturls = [x['url'] for x in data]

    new_data = []
    for dt in data:
        new_options = dt['options']
        if len(new_options) > 1:
            new_options = new_options[1:]
        
        if dt['url'] != dt['parent_url'] and dt['parent_url'] != '':
            print('not matched parent    ', dt['url'])
            try:
                id = producturls.index(dt['parent_url'])
                new_data.append({
                    'options': new_options,
                    'brand': dt['brand'],
                    'name': data[id]['name'],
                    'url': dt['url'],
                    'description': dt['description']
                })
            except:
                print('------- error')
                new_data.append({
                    'options': new_options,
                    'brand': dt['brand'],
                    'name': dt['name'],
                    'url': dt['url'],
                    'description': dt['description']
                })
        else:
            new_data.append({
                'options': new_options,
                'brand': dt['brand'],
                'name': dt['name'],
                'url': dt['url'],
                'description': dt['description']
            })
    
    return new_data

def remove_duplicated_data(data):
    skus = {}
    for dt in data:
        skus[dt['name']] = []

    new_data = []

    for dt in data:
        new_options = []
        for op in dt['options']:
            if op['skuNumber'] not in skus[dt['name']]:
                new_options.append(op)
                skus[dt['name']].append(op['skuNumber'])
        if (len(new_options) > 0):
            new_data.append({
                'options': new_options,
                'brand': dt['brand'],
                'name': dt['name'],
                'url': dt['url'],
                'description': dt['description']
            })

def refactor(data):
    refactored_data = []
    count = 0
    for dt in data:
        handle = dt["url"].split('https://www.polyperformance.com/')[1]
        title = dt["name"]
        body = dt["description"]
        vendor = dt["brand"]

        for oid, option in enumerate(dt["options"]):
            skunumber = option["skuNumber"]
            finalprice = option["finalprice"]
            oldprice = option["oldprice"]

            if oldprice == "":
                oldprice = "0"
            try:
                num_finalprice = float(finalprice.replace(",", ""))
            except:
                num_finalprice = 0
                pass
            num_oldprice = float(oldprice.replace(",", ""))

            if num_oldprice > num_finalprice * 1.7:
                oldprice = finalprice
                count += 1
            if num_oldprice == 0 or num_oldprice < num_finalprice:
                oldprice = finalprice
            optionname = option["skuNumber"]


            for i, img in enumerate(option["images"]):
                temp_pd = {
                    "Handle": handle,
                    "Title": title,
                    "Body (HTML)": body,
                    "Vendor": vendor,
                    "Product Category": "",
                    "Type": "",
                    "Tags": "",
                    "Published": "",
                    "Option1 Name": "Part #",
                    "Option1 Value": optionname,
                    "Variant SKU": skunumber,
                    "Variant Price": finalprice,
                    "Variant Compare At Price": oldprice,
                    "Variant Requires Shipping": "",
                    "Variant Taxable": "",
                    "Variant Barcode": "",
                    "Image Src": img,
                    "Image Position": i+1,
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
                }

                if optionname == "original":
                    temp_pd['Option1 Name'] = ""
                    temp_pd['Option1 Value'] = ""

                if len(dt["options"]) == 1:
                    temp_pd['Option1 Name'] = ""
                    temp_pd['Option1 Value'] = ""


                if oid == 0 and i == 0:
                    refactored_data.append(temp_pd)
                else:
                    temp_pd['Option1 Name'] = ""
                    temp_pd["Title"] = ""
                    temp_pd["Body (HTML)"] = ""
                    temp_pd["Vendor"] = ""

                    if i != 0:
                        temp_pd['Option1 Name'] = ""
                        temp_pd['Option1 Value'] = ""
                        temp_pd["Variant SKU"] = ""
                        temp_pd["Variant Price"] = ""
                        temp_pd["Variant Compare At Price"] = ""

                    refactored_data.append(temp_pd)
    print(count)
    return refactored_data


def convert(data, output_file_path):
    # Check if data is a list of records (dictionaries)
    if isinstance(data, list) and all(isinstance(item, dict) for item in data):
        # Get the headers (keys) for the CSV file from the first JSON object
        headers = list(data[0].keys())

        # Write to the CSV file
        with open(output_file_path, 'w', newline='', encoding='utf-8') as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=headers)

            # Write the header row
            writer.writeheader()
            
            # Write each data row
            for row in data:
                writer.writerow(row)
    else:
        print("JSON data is not a list of dictionaries.")

    print(f"The JSON data has been successfully converted to '{output_file_path}'.")

def get_csv():
    data = []
    for fn in filenames:
        with open(f"./assets/data/{fn}", "r", encoding="utf-8") as f:
            data += json.load(f)

    new_data = get_new_data(data)
    removed_data = remove_duplicated_data(data)
    refactored_data = refactor(new_data)
    convert(refactored_data, './assets/output.csv')

get_csv()