# Andhra Pradesh Agriculture Knowledge Base — Official Source Directory

Verified links for every row in your table, checked July 2026. One important correction up front: **YSR Rythu Bharosa was discontinued and replaced in August 2025** by the new AP government — the current scheme is **Annadata Sukhibhava**. Point any build at the new portal, not the old one.

Also worth knowing before you build on this: almost none of this is literally "8 PDFs." It's a mix of static PDFs, live government portals, and one image-only dataset. Format is noted under each section.

---

## 1. 🌾 Crop Guides — cultivation, sowing, harvesting

| Source | What it has | Link |
|---|---|---|
| ANGRAU (Acharya N.G. Ranga Agricultural University) | AP's state agricultural university — package-of-practices, research bulletins, extension notes | https://angrau.ac.in/ |
| Dr. YSR Horticultural University | AP's dedicated horticulture university — fruit, vegetable, spice, flower crop guides | https://drysrhu.ap.gov.in/ |
| ICAR e-Courses – Farmer Portal | ICAR + State Agricultural University training material, organized by crop/discipline | https://ecourses.icar.gov.in/Home_farmer.aspx |
| Farmer Portal (Govt of India) | Crop-wise cultivation info, weather, market prices in one place | https://farmer.gov.in/ |

**Format:** PDFs + web pages, updated by each institution independently. No single bulk download — you'd pull crop by crop.

---

## 2. 🐛 Disease Library — symptoms, causes, treatment

**Heads-up on a mismatch in the original plan:** PlantVillage is an *image* dataset, not text. It's 54,306 leaf photos labeled by crop+disease (38 classes) — built for training an image classifier, with no written symptom/cause/treatment descriptions attached. For the actual text content, you need a second source.

| Source | What it has | Link |
|---|---|---|
| PlantVillage dataset (images only) | 54,306 labeled leaf images, 14 crops × 38 disease/healthy classes | https://github.com/spMohanty/PlantVillage-Dataset |
| PlantVillage on Kaggle | Same dataset, easier one-click download | https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset |
| TNAU Agritech Portal | Real symptom + management text, crop-by-crop | https://agritech.tnau.ac.in/ |
| ICAR e-Course: Fundamentals of Plant Pathology | Textbook coverage of disease causes, symptoms, cycles | via https://ecourses.icar.gov.in/Home_farmer.aspx |

**Format:** PlantVillage = image folders (~2GB). TNAU/ICAR = PDF text. Note the original plantvillage.org no longer hosts the raw files directly — GitHub/Kaggle are now the working mirrors.

---

## 3. 🏛️ Govt Schemes — PM-KISAN, PMFBY, Rythu Bharosa

| Scheme | Status | Official portal |
|---|---|---|
| PM-KISAN | Active, central scheme, ₹6,000/yr | https://pmkisan.gov.in/ |
| PMFBY (crop insurance) | Active, central scheme | https://pmfby.gov.in/ |
| ~~YSR Rythu Bharosa~~ → **Annadata Sukhibhava** | Renamed Aug 2025 under the new AP government; ₹20,000/yr (₹14,000 state + ₹6,000 central via PM-KISAN) | https://annadathasukhibhava.ap.gov.in/ |

**Format:** Portal + downloadable guideline PDFs (eligibility, operational guidelines). Each has a "Know Your Status" Aadhaar lookup.

---

## 4. 🧪 Pesticide Guide — chemicals, organic alternatives, dosage

| Source | What it has | Link |
|---|---|---|
| PPQS / CIBRC — Major Uses of Pesticides | Official government crop-pest-chemical-dosage database | https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides |
| PPQS — Registered Products | Every legally registered pesticide product in India | https://ppqs.gov.in/divisions/cib-rc/registered-products |
| AICRP — Approved Label Claims & MRL | Crop-pesticide combinations with safe waiting periods and residue limits | https://aicrp.icar.gov.in/pesticide/approved-label-claim-and-mrl/ |

**Format:** Searchable web tables + circulars. There's no single "pesticide guide PDF" — it's assembled from these registries.

---

## 5. 💧 Irrigation Guide — water requirements, drip/sprinkler, weather-based advice

| Source | What it has | Link |
|---|---|---|
| PMKSY – Per Drop More Crop (Micro-Irrigation) | National drip/sprinkler subsidy scheme | https://pmksy.gov.in/microirrigation/ |
| PMKSY Micro-Irrigation Guidelines (PDF) | Full scheme document: subsidy %, eligible systems, process | https://pmksy.gov.in/microirrigation/Archive/GuidelinesMIRevised250817.pdf |
| Crop water-requirement tables | Usually embedded inside ANGRAU/ICAR crop guides (Section 1), not a standalone doc | see Section 1 |

**Format:** Scheme PDFs + portal.

---

## 6. ⛅ Weather Advisory — seasonal, frost/heat stress guidance

| Source | What it has | Link |
|---|---|---|
| IMD Agromet Advisory Service — AP state bulletins | 5-day, district-level advisories, issued twice weekly (Tue/Fri), crop-specific | https://mausam.imd.gov.in/responsive/agromet_adv_ser_state_current.php |
| Live example (current AP bulletin PDF) | Actual current bulletin, auto-refreshed each issue | https://mausam.imd.gov.in/visakhapatnam/mcdata/APAgromet.pdf |

**Format:** Free PDF bulletins, no login. Easiest category here to actually automate on a schedule.

---

## 7. 💰 Market Prices — historical trends, MSP

| Source | What it has | Link |
|---|---|---|
| Agmarknet | Daily mandi-level prices (min/max/modal) across India | https://agmarknet.gov.in/ |
| data.gov.in (Open Government Data Platform) | Same underlying data, but as downloadable CSV / API — far better for anything programmatic | https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi |

**Format:** Live database, not a PDF. Best pulled via the data.gov.in API (free key).

---

## 8. 🌱 Soil Health — fertilizer recommendations, soil testing

| Source | What it has | Link |
|---|---|---|
| Soil Health Card portal | Farmer-level soil test results + crop-wise fertilizer dosage | https://soilhealth.dac.gov.in/ |
| KVK directory — Andhra Pradesh (24 centers) | Every KVK in AP runs a soil-testing lab; official list with locations | https://icar.org.in/en/node/15047 |
| KVK portal | Search any KVK by state/district | https://kvk.icar.gov.in/ |

**Format:** Portal lookup (per-farmer, needs land records) + physical lab addresses — a service, not a downloadable document.

---

## What I can't hand you directly, and what I can do next

I can't bulk-download all of this into a ready-made package in one shot: several portals need CAPTCHA/form navigation that can't be automated from here, PlantVillage is a multi-gigabyte image set, and Agmarknet is a live database rather than a fixed file.

What I *can* do if you want to go deeper on any one category:
- Pull and summarize a specific document's content (e.g., PMFBY eligibility rules, this week's AP weather advisory) into plain text
- Help structure any of this into a CSV/JSON schema if you're feeding it into a chatbot or app
- Write the actual scraper/downloader code for the categories that are automatable (IMD bulletins, Agmarknet via the data.gov.in API)
