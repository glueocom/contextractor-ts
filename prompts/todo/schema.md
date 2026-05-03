Modify Contextractor's schema.                                                                  
Instead of saveRawHtmlToKeyValueStore saveExtractedTextToKeyValueStore saveExtractedJsonToKeyValueStore etc in           
'/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/.actor/input_schema.json' there must be in style like in      
'/Users/miroslavsekera/r/contextractor-ts/temp/input-schema.json'                                                        
                                                                                                                           
"Raw html" will be called "original" instead                                                                             
                                                                                                                           
Only for Apify Actor, there will be another array of possibilities where to save the output, for now it will have two values - dataset and key value store (default checked key value store). the npm package( cli, typescript lib    will be saving it to disk only, and won't have that settings)                                                                                                          
                                                                                                                           
Write the prompt to a subfolder of '/Users/miroslavsekera/r/contextractor-ts/prompts', to a one-file prompt   