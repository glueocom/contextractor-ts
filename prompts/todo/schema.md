modify contextractors schema.                                                                  
  instead of saveRawHtmlToKeyValueStore saveExtractedTextToKeyValueStore saveExtractedJsonToKeyValueStore etc in           
  '/Users/miroslavsekera/r/contextractor-ts/apps/apify-actor/.actor/input_schema.json' there must be in style like in      
  '/Users/miroslavsekera/r/contextractor-ts/temp/input-schema.json'                                                        
                                                                                                                           
  "raw html" will be called "original" instead                                                                             
                                                                                                                           
  only for apify actor, there will be another array of possibilities where to save the actor, for now it will have two values - dataset and key value store (default checked key value store). the npm package( cli, typescript lib    will be saving it to disk only, and wont have that settings)                                                                                                          
                                                                                                                           
  write the promt to a subfolder of '/Users/miroslavsekera/r/contextractor-ts/prompts', to an one file prompt   