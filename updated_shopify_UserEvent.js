/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */

define(['N/log', 'N/search', 'N/record', 'N/https'], function (log, search, record, https) {

    function afterSubmit(context) {
        // Check if the record is being created or edited
        if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
            try {
                var inventoryRecord = context.newRecord; // Get the new record being submitted
                var itemId = inventoryRecord.id; // Get the ID of the record
                log.debug("Record Id :", itemId); // Log the record ID for debugging

                log.debug("Script Triggered", context.type); // Log the event type (CREATE or EDIT)

                var salesorder = []; // Initialize an array to hold items for processing

                // Create a saved search to find inventory items
                var mySearch = search.create({
                    type: "inventoryitem",
                    filters: [
                        ["type", "anyof", "InvtPart"], // Filter for inventory part type
                        "AND",
                        ["quantityavailable", "greaterthan", "0"], // Only items with available quantity
                        "AND",
                        ["averagecost", "greaterthanorequalto", "0.00"] // Only items with a valid average cost
                    ],
                    columns: [
                        "internalid", // Internal ID of the inventory item
                        "itemid", // Item ID
                        "displayname", // Display name of the item
                        "salesdescription", // Description of the item
                        "quantityavailable", // Available quantity
                        "averagecost", // Average cost of the item
                        "custitemshopify_item_id"  // Custom field for storing Shopify Product ID
                    ]
                });

                // Run the saved search and paginate results
                var pageData = mySearch.runPaged({ pageSize: 10 });

                // Iterate through each page of results
                pageData.pageRanges.forEach(function (pageRange) {
                    var page = pageData.fetch({ index: pageRange.index }); // Fetch the current page of results

                    // Iterate through each result in the page
                    page.data.forEach(function (result) {
                        // Push relevant data into the salesorder array
                        salesorder.push({
                            Internal_ID: result.id, // Store internal ID
                            ItemId: result.getValue({ name: 'itemid' }), // Store item ID
                            DisplayName: result.getValue({ name: 'displayname' }), // Store display name
                            Description: result.getValue({ name: 'salesdescription' }), // Store description
                            QTY: result.getValue({ name: 'quantityavailable' }), // Store available quantity
                            Cost: result.getValue({ name: 'averagecost' }), // Store average cost
                            Shopify_Product_ID: result.getValue({ name: 'Field Internal Id ' }) // Get the Shopify Product ID from the custom field
                        });
                    });
                });

                log.debug("NetSuite Items:", JSON.stringify(salesorder)); // Log all items for debugging

                // Iterate over each item in the salesorder array
                salesorder.forEach(function (item) {
                    // Ensure the price is valid; default to "0.00" if not
                    var price = item.Cost && !isNaN(item.Cost) ? item.Cost : "0.00";  
                    log.debug("Item Cost:", item.Cost); // Log the cost of the item for debugging

                    // Create the payload for the Shopify API request
                    var productPayload = {
                        "product": {
                            "title": item.Internal_ID + " - " + item.DisplayName, // Product title combines internal ID and display name
                            "body_html": item.Description, // Use item description as product body
                            "variants": [
                                {
                                    "price": price, // Set the price of the variant
                                    "inventory_quantity": item.QTY // Set the available quantity
                                }
                            ]
                        }
                    };

                    // Define the headers for the API request
                    var headers = {
                        'Content-Type': 'application/json', // Set content type to JSON
                        'X-Shopify-Access-Token': 'use here Shopify acces token ' // Include Shopify access token
                    };

                    var shopName = 'Your shopify shop name '; // Define the Shopify store name
                    var shopifyUrl = 'https://' + shopName + '.myshopify.com/admin/api/2024-04/products.json'; // Base URL for Shopify API
                    log.debug("Shopify URL", shopifyUrl); // Log the Shopify URL for debugging

                    // Check if the Shopify Product ID exists to determine if we should update or create a product
                    if (item.Shopify_Product_ID) {
                        // Update existing product if Shopify Product ID is present
                        var updateUrl = shopifyUrl.replace('/products.json', '/products/' + item.Shopify_Product_ID + '.json'); // Construct update URL
                        var response = https.put({
                            url: updateUrl, // Set the URL for the PUT request
                            headers: headers, // Include the headers
                            body: JSON.stringify(productPayload) // Send the product payload as JSON
                        });
                        log.debug("Shopify Update Response", response.body); // Log the response from Shopify
                    } else {
                        // Create a new product if no Shopify Product ID exists
                        var response = https.post({
                            url: shopifyUrl, // Set the URL for the POST request
                            headers: headers, // Include the headers
                            body: JSON.stringify(productPayload) // Send the product payload as JSON
                        });
                        log.debug("Shopify Create Response", response.body); // Log the response from Shopify

                        // Parse the response to get the new Shopify Product ID
                        var newProductId = JSON.parse(response.body).product.id;

                        // Update the NetSuite record with the new Shopify Product ID
                        record.submitFields({
                            type: record.Type.INVENTORY_ITEM,  // Specify the type of the record to update
                            id: item.Internal_ID,              // Provide the internal ID of the record in NetSuite
                            values: {
                                custitemshopify_item_id: newProductId  // Update the custom field with the new Shopify Product ID
                            }
                        });
                        // ^^^ Changed from submitField to submitFields for correct function usage.
                    }
                });

                return "Successfully Updated or Created Products in Shopify."; // Return success message

            } catch (error) {
                log.error("Error during Shopify API Call", error); // Log any errors that occur during the process
            }
        }
    }

    return {
        afterSubmit: afterSubmit // Return the afterSubmit function for execution
    };

});
