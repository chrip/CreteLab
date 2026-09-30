# Concrete objects: research list

146 objects people cast from concrete, found in German and English DIY, DIY-store, manufacturer and forum sources. The data is in `concrete-objects.json`, one record per object. The `covered_by` field names the existing topic in `ml/make_dataset.py` (SCENARIOS, DIY_SCENARIOS, BAGGED_SCENARIOS, SHAPE_SCENARIOS) that already covers it.

## Counts

| Group | Total | New | Covered |
|---|---|---|---|
| A Building / structural | 43 | 21 | 22 |
| B Garden & landscaping | 37 | 20 | 17 |
| C Indoor / furniture / fixtures | 25 | 10 | 15 |
| D Small DIY / decorative | 41 | 24 | 17 |
| **All** | 146 | 75 | 71 |

## New objects

**A Building / structural:** Fundament Fertiggarage (Streifen-/Ringfundament) (foundation for a prefab garage (strip/ring footing)); Sickergrube / Klärgrube (soakaway / septic pit); Mauerabdeckung (wall coping stones); Garagenrampe / Auffahrtsrampe (garage / driveway ramp); Rollstuhlrampe am Hauseingang (wheelchair ramp at the entrance); Lichtschacht / Lichtschachtaufsatz (basement light well); Ringanker (ring beam); Güllebehälter (slurry tank); Mistplatte (manure storage slab); Eingangspodest (entrance landing / doorstep platform); Zaunsockel (fence plinth / fence base wall); Streifenfundament für Gabionen (strip footing for gabion walls); Bodenplatte für Aufstellpool (base slab for an above-ground pool); Whirlpool-Fundament (hot tub base slab); Fundament Ladesäule / Wallbox-Standfuß (foundation for an EV charger post); Fundament Mülltonnenbox (foundation slab for a bin shelter); Fundament PV-Gestell im Garten (footings for a ground-mounted solar rack); Fundament Pizzaofen (base slab for a garden pizza oven); Boden Pferdestall / Stallgasse (horse stable floor / stable aisle); Bodenplatte Hundezwinger (dog kennel floor slab with fall); Autowaschplatz (car wash bay on private property)

**B Garden & landscaping:** Palisaden setzen mit Rückenstütze (setting palisades with concrete haunch); Pflastersteine selber gießen (home-cast paving stones); Gehwegplatten / Terrassenplatten gießen (home-cast paving slabs / patio slabs); Hochbeet aus Beton (raised bed cast in concrete); Grillplatz im Garten (paved/concrete grill area); Außenküche-Arbeitsplatte (outdoor kitchen countertop); Bachlauf aus Beton (concrete garden stream); Tischtennisplatte aus Beton (concrete ping-pong table); Riesen-Schachspiel aus Betonplatten (giant chess set from concrete pavers); Sonnenuhr aus Beton (concrete sundial); Pflanzenstecker / Beetschilder (plant markers); Briefkastensäule (letterbox column); Windlichtsäule (lantern column); Ablaufrinne / Wasserrinne (drainage channel / rain spout gutter); Hausnummer aus Beton (concrete house number sign); Sichtschutzwand aus Beton (concrete privacy screen wall); Sitzblock / Sitzstufe (concrete seat block / seating step); Pollerleuchte / Gartenleuchte (concrete bollard garden light); Futtertrog / Viehtränke (feed trough / livestock water trough); Betonkanu / Ferrozement-Boot (concrete canoe / ferrocement boat)

**C Indoor / furniture / fixtures:** Duschboden / bodengleiche Dusche (walk-in shower floor with fall); Badewanne aus Beton (concrete bathtub); TV-Board / Lowboard (TV stand / lowboard); Zementfliesen / Betonfliesen (cement tiles / concrete floor tiles); Sichtestrich / Betonboden im Wohnraum (polished concrete / exposed screed floor); Zementestrich (cement screed); Kaminumrandung aus Beton (concrete fireplace surround); Podest / Fundament für Kaminofen (hearth base for a wood stove); Küchentresen / Theke (kitchen bar counter); Lautsprechergehäuse (concrete speaker enclosure)

**D Small DIY / decorative:** Wanduhr aus Beton (concrete wall clock); Tablet-/Handyhalter (tablet / phone stand); Stiftehalter (pen holder); Weihnachtsbaum aus Beton (concrete Christmas tree); Betonsterne / Christbaumanhänger (concrete stars / tree ornaments); Ostereier aus Beton (concrete Easter eggs); Kürbisse aus Beton (concrete pumpkins); Schmuck aus Beton (Kette, Anhänger) (concrete jewellery (necklace, pendant)); Ringhalter (ring holder); Magnete (hex fridge magnets); Dominosteine / Spielsteine (dominoes / game pieces); Betonbuchstaben (concrete letters); Kartenhalter / Fotohalter (card / photo holder); Türstopper (door stop); Tischdeckenbeschwerer (tablecloth weights); Aschenbecher (ashtray); Räucherstäbchenhalter (incense holder); Tillandsienhalter (air-plant holder); Deko-Häuschen (small decorative concrete houses); Käsebrett / Servierbrett (cheese / serving board); Möbelknöpfe / Griffe (drawer pulls / knobs); Wandhaken (Glühbirnenform) (lightbulb-shaped wall hook); Hausnummern-/Logo-Relief, 3D-Logo (3D logo / relief panel); Futternapf für Hund/Katze (pet food bowl)

## Notes on the data

- The property values (water, frost, de-icing salt, reinforcement, traffic, size, thickness, method) are typical values for the object. They come from the sources or from common practice and are not measurements. Where a property depends on the specific build, the value is `either`.
- Every object has one source URL where it shows up as a concrete project or product. Most are DIY guides. A few are manufacturer or product pages because no DIY guide was found: Rinn (Sitzblock), KRAMP (Futtertrog), gartenleuchten.de (Pollerleuchte), gutmann.design (Räucherstäbchenhalter), wolfsystem (Güllebehälter, Fahrsilo). Some are forum threads: bauexpertenforum, hausbau-forum, energiesparhaus.
- An object is marked `covered` only when an existing topic is essentially the same object. Wide catch-all topics were not stretched to cover different objects. For example, "coasters, soap dish or small decor" does not cover magnets or ring holders.

## Sources by domain

- www.grey-element.de (26)
- www.handmadekultur.de (17)
- www.hausjournal.net (5)
- www.hornbach.de (4)
- www.helpster.de (3)
- www.bauexpertenforum.de (3)
- selbermachen.de (3)
- www.beton.org (3)
- www.hornbach.at (2)
- toom.de (2)
- www.sakret.de (2)
- wolfsystem.de (2)
- www.sakret.ch (2)
- www.heimwerker.sakret.de (2)
- www.selbst.de (2)
- www.obi.de (2)
- www.youtube.com (2)
- lovelyindeed.com (2)
- www.garage-und-carport.de (1)
- neu-west.com (1)
- www.promotor-shop.de (1)
- www.hausgarten.net (1)
- www.pool-selber-bauen.de (1)
- www.deutscher-bauzeiger.de (1)
- www.heimwerkertricks.net (1)
- www.hausbaumagazin.at (1)
- www.topagrar.com (1)
- www.hausbau-forum.de (1)
- www.baucheck.io (1)
- www.gabinova.de (1)
- fundamentwelt.de (1)
- www.photovoltaik.info (1)
- pizzaofen-bauanleitung.com (1)
- www.huehner-ratgeber.de (1)
- www.bau-welt.de (1)
- www.baumit-selbermachen.de (1)
- www.hausbauen24.eu (1)
- www.dreamalittlebigger.com (1)
- www.betonformen24.de (1)
- www.gartenpflege-tipps.de (1)
- www.kuheiga.com (1)
- grillstube.eu (1)
- www.leitermann.de (1)
- deavita.com (1)
- www.gartenjournal.net (1)
- www.houseofhawthornes.com (1)
- www.makingmanzanita.com (1)
- www.tischtennisplatte.net (1)
- diydanielle.com (1)
- www.tueftler-und-heimwerker.de (1)
- reusegrowenjoy.com (1)
- gadero.de (1)
- www.rinn.net (1)
- www.gartenleuchten.de (1)
- www.kramp.com (1)
- www.scrappygeek.com (1)
- www.downredbuddrive.com (1)
- www.popsci.com (1)
- www.bauabenteuer.de (1)
- www.charlestoncrafted.com (1)
- www.poco.de (1)
- diy-coach.de (1)
- bundk.design (1)
- www.energiesparhaus.at (1)
- fasheria.com (1)
- yeah-handmade.de (1)
- fraufriemel.de (1)
- craftinvaders.co.uk (1)
- www.simplenaturedecorblog.com (1)
- www.anikasdiylife.com (1)
- www.annefaktur.de (1)
- www.sweetsillysara.com (1)
- dukesandduchesses.com (1)
- www.diy-academy.eu (1)
- www.aschenbecher.com (1)
- gutmann.design (1)
- www.adailysomething.com (1)
- projektila.blogspot.fi (1)
- www.instructables.com (1)
- artsyprettyplants.com (1)

Starting points for browsing: grey-element.de sitemap, handmadekultur.de/projekte/beton, diydanielle.com/diy-concrete-projects/, homedit.com/34-cool-and-modern-diy-concrete-projects/, beton.org/inspiration/mehr-inspiration/tolle-ideen-mit-beton/, Hornbach/toom/OBI/Sakret project guides.
