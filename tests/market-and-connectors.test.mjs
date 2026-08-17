import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatMoney, normaliseMarketSettings } from "../lib/market.ts";
import { defaultTaxConfiguration, normaliseTaxConfiguration } from "../lib/tax.ts";
import { CONNECTORS, connectorAuthoriseUrl, connectorRedirectUri } from "../lib/connectors.ts";

test("UK and US market profiles fail closed to supported currency and locale pairs",()=>{
  assert.deepEqual(normaliseMarketSettings({market:"GB",currency:"USD",locale:"en-US"}),{market:"GB",countryCode:"GB",locale:"en-GB",currency:"GBP",timezone:"Europe/London",taxRegistrationStatus:"registered",pricesIncludeTax:false});
  assert.deepEqual(normaliseMarketSettings({countryCode:"US",currency:"GBP",locale:"en-GB"}),{market:"US",countryCode:"US",locale:"en-US",currency:"USD",timezone:"America/New_York",taxRegistrationStatus:"registered",pricesIncludeTax:false});
});

test("regional formatting presents the same minor units correctly in both key markets",()=>{
  assert.equal(formatMoney(123456,"GBP","en-GB"),"Â£1,234.56");
  assert.equal(formatMoney(123456,"USD","en-US"),"$1,234.56");
  assert.equal(formatDate("2026-08-17","en-GB","Europe/London"),"17 August 2026");
  assert.equal(formatDate("2026-08-17","en-US","America/New_York"),"August 17, 2026");
});

test("UK defaults preserve statutory treatment distinctions",()=>{
  const configuration=defaultTaxConfiguration("GB");
  assert.equal(configuration.defaultTaxCode,"GB_STANDARD");
  assert.deepEqual(configuration.treatments.map(treatment=>treatment.code),["GB_STANDARD","GB_REDUCED","GB_ZERO","GB_EXEMPT","GB_OUT_OF_SCOPE"]);
});

test("US defaults never invent a state or local rate",()=>{
  const configuration=defaultTaxConfiguration("US");
  assert.equal(configuration.defaultTaxCode,"US_OUT_OF_SCOPE");
  assert.deepEqual(configuration.treatments.find(treatment=>treatment.code==="US_SALES_TAX")?.components,[]);
});

test("invalid persisted tax components are removed at the boundary",()=>{
  const configuration=normaliseTaxConfiguration({defaultTaxCode:"US_SALES_TAX",treatments:[{code:"US_SALES_TAX",label:"Sales tax",calculation:"exclusive",components:[{id:"bad",label:"Bad",jurisdictionCode:"US-X",jurisdictionLevel:"state",rateBp:-1},{id:"good",label:"State",jurisdictionCode:"US-X",jurisdictionLevel:"state",rateBp:725}]}]},"US");
  assert.equal(configuration.treatments[0].components.length,1);
  assert.equal(configuration.treatments[0].components[0].rateBp,725);
});

test("every managed connector uses an HTTPS OAuth endpoint and signed-state slot",()=>{
  for(const definition of Object.values(CONNECTORS)){
    assert.equal(new URL(definition.authoriseUrl).protocol,"https:");
    assert.equal(new URL(definition.tokenUrl).protocol,"https:");
    const redirect=connectorRedirectUri("https://app.quotebenchhq.com",definition.provider);
    const authorise=new URL(connectorAuthoriseUrl(definition,"client-id",redirect,"signed-state"));
    assert.equal(authorise.searchParams.get("state"),"signed-state");
    assert.equal(authorise.searchParams.get("redirect_uri"),redirect);
  }
});

