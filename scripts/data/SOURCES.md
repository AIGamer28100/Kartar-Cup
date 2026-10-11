# Track data sources

All geometry: https://github.com/bacinger/f1-circuits (branch master), fetched 2026-09-27.
License: MIT, Copyright (c) 2019-2025 Tomislav Bacinger (full text in `f1-circuits-LICENSE.md`,
fetched from https://raw.githubusercontent.com/bacinger/f1-circuits/master/LICENSE.md; GitHub API also reports MIT).

Base URL: https://raw.githubusercontent.com/bacinger/f1-circuits/master/

| Local file | Remote path |
|---|---|
| f1-circuits-LICENSE.md | LICENSE.md |
| f1-locations.json | f1-locations.json |
| circuits/<id>.geojson | circuits/<id>.geojson for id in: az-2016 my-1999 sg-2008 us-2012 mx-1962 br-1940 us-2023 qa-2004 ae-2009 bh-2002 sa-2021 au-1953 jp-1962 cn-2004 us-2022 ca-1978 mc-1929 pt-2008 gb-1948 at-1969 be-1925 hu-1986 it-1922 es-2026 tr-2005 |

Each GeoJSON is one LineString (ordered lon/lat, no start/finish marker property), so `start` is null everywhere.
Point order/direction of travel is as in the source and not verified against the real race direction.

## Race -> venue verification

| Race | Circuit | Source |
|---|---|---|
| 2026 R16 Gulf Air Bahrain GP in Malaysia (2-4 Oct) | Sepang International Circuit | https://www.formula1.com/en/latest/article/formula-1-and-fia-confirm-malaysia-will-join-2026-calendar-as-host-venue-for-bahrain-grand-prix.6lL7vjFEM2VVynRHvg1TCf ; https://en.wikipedia.org/wiki/2026_Bahrain_Grand_Prix |
| 2026 R15 / 2027 R16 Azerbaijan | Baku City Circuit | f1-circuits index (Baku) |
| 2026/27 Singapore, Austin, Mexico City, Sao Paulo, Las Vegas, Lusail, Abu Dhabi, and 2027 Sakhir, Jeddah, Melbourne, Suzuka, Shanghai, Miami, Montreal, Monaco, Silverstone, Spielberg, Spa, Budapest, Monza | each city's long-standing F1 venue, per f1-locations.json | https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-locations.json |
| 2027 R9 Portugal | Autodromo Internacional do Algarve (Portimao) | https://africa.espn.com/f1/story/_/id/47321996/portugals-portimao-circuit-joins-f1-calendar-2027-2028 |
| 2027 R15 Spain | Circuito de Madring (Madrid) | https://www.planetf1.com/news/f1-2027-calendar-schedule-race-dates |
| 2027 R17 Turkiye | Istanbul Park | https://www.turkiyetoday.com/sports/turkish-grand-prix-confirmed-for-oct-1-3-2027-3228251 |

Caveat: the 2027 calendar is subject to FIA homologation (Istanbul Park). Qatar circuit is named Lusail
International Circuit in the app; the source dataset labels it "Losail International Circuit".
