import test from "node:test";
import assert from "node:assert/strict";
import { toLegacyDefinition, toLegacyFormRecord } from "../../../dist/modules/forms/legacy-definition.js";
test("v1 form projection preserves authored text, identifiers and historical field settings without new metadata", () => {
 const definition={title:"لغة",description:"French / العربية",language:"ar",fields:[{id:"name",type:"name",label:"language",placeholder:"Enter name",minLength:2,maxLength:160},{id:"email",type:"email",label:"Email",minLength:4,maxLength:50},{id:"n",type:"number",label:"Number",min:0,max:10,step:0.5},{id:"rating",type:"rating",label:"Rating",min:1,max:5,step:1}]};
 const before=structuredClone(definition), legacy=toLegacyDefinition(definition);
 assert.deepEqual(definition,before);assert.equal(legacy.language,undefined);assert.equal(legacy.title,"لغة");
 assert.deepEqual(legacy.fields,[{id:"name",type:"name",label:"language",minLength:2,maxLength:160},{id:"email",type:"email",label:"Email"},{id:"n",type:"number",label:"Number",min:0,max:10},{id:"rating",type:"rating",label:"Rating",min:1,max:5,step:1}]);
 assert.deepEqual(toLegacyFormRecord({id:"form",draftDefinition:definition}),{id:"form",draftDefinition:legacy});
 assert.deepEqual(toLegacyFormRecord({id:"version",definition}),{id:"version",definition:legacy});
});

import { preserveLegacyDraftMetadata } from "../../../dist/modules/forms/legacy-definition.js";
test("an old editor title change preserves newer language and validation settings",()=>{
 const id=(n)=>"11111111-1111-4111-8111-"+String(n).padStart(12,"0");
 const stored={title:"Original",description:"",language:"ar",fields:[{id:id(1),type:"number",label:"Number",description:"",required:false,min:0,max:10,step:2,placeholder:"رقم"},{id:id(2),type:"email",label:"Email",description:"",required:false,minLength:5,maxLength:80}]};
 const incoming={...toLegacyDefinition(stored),title:"Changed"};
 const merged=preserveLegacyDraftMetadata(incoming,stored);
 assert.equal(merged.title,"Changed");assert.equal(merged.language,"ar");assert.deepEqual(merged.fields,stored.fields);
 const changedType={...incoming,fields:[{...incoming.fields[0],type:"shortText",min:undefined,max:undefined}]};
 delete changedType.fields[0].min;delete changedType.fields[0].max;
 const changed=preserveLegacyDraftMetadata(changedType,stored);
 assert.equal(changed.fields.length,1);assert.equal(changed.fields[0].step,undefined);
});
