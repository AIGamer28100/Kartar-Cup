[NAV\\
 ![](https://openf1.org/docs/images/navbar-cad8cdcb.png)](https://openf1.org/docs/#)

[![](https://openf1.org/docs/images/logo-cc63fb5d.png)](https://openf1.org/)

- [Introduction](https://openf1.org/docs/#introduction)
- [API endpoints](https://openf1.org/docs/#api-endpoints)  - [Car data](https://openf1.org/docs/#car-data)
  - [Drivers championship (beta)](https://openf1.org/docs/#drivers-championship-beta)
  - [Teams championship (beta)](https://openf1.org/docs/#teams-championship-beta)
  - [Drivers](https://openf1.org/docs/#drivers)
  - [Intervals](https://openf1.org/docs/#intervals)
  - [Laps](https://openf1.org/docs/#laps)
  - [Location](https://openf1.org/docs/#location)
  - [Meetings](https://openf1.org/docs/#meetings)
  - [Overtakes](https://openf1.org/docs/#overtakes)
  - [Pit](https://openf1.org/docs/#pit)
  - [Position](https://openf1.org/docs/#position)
  - [Race control](https://openf1.org/docs/#race-control)
  - [Sessions](https://openf1.org/docs/#sessions)
  - [Session result](https://openf1.org/docs/#session-result)
  - [Starting grid](https://openf1.org/docs/#starting-grid)
  - [Stints](https://openf1.org/docs/#stints)
  - [Team radio](https://openf1.org/docs/#team-radio)
  - [Weather](https://openf1.org/docs/#weather)
- [Data filtering](https://openf1.org/docs/#data-filtering)  - [Time-Based Filtering](https://openf1.org/docs/#time-based-filtering)
- [CSV Format](https://openf1.org/docs/#csv-format)
- [Tutorials](https://openf1.org/docs/#tutorials)
- [Community and Support](https://openf1.org/docs/#community-and-support)
- [Contributing](https://openf1.org/docs/#contributing)  - [Contributors](https://openf1.org/docs/#contributors)

- [![](https://storage.googleapis.com/openf1-public/images/github.png)\\
br-g/openf1](https://github.com/br-g/openf1)
- [![](https://storage.googleapis.com/openf1-public/images/bmec.png)\\
Buy me a coffee](https://www.buymeacoffee.com/openf1)
- [Contact](https://openf1.org/contact)  \|  Made in Paris, France ![](https://storage.googleapis.com/openf1-public/images/france_flag.png)


# Introduction

OpenF1 is an open-source API providing detailed Formula 1 telemetry, timing, and session data in JSON and CSV formats.

Historical data (from 2023 onwards) is free and accessible without authentication. Real-time data requires [a paid subscription](https://buy.stripe.com/eVqcN41BPekP0iIalBcEw02).

You can query the API directly through your browser or HTTP client. Explore the endpoints below to get started.

# API endpoints

## Car data

Some data about each car, at a sample rate of about 3.7 Hz.

```
curl "https://api.openf1.org/v1/car_data?driver_number=55&session_key=9159&speed>=315"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/car_data?driver_number=55&session_key=9159&speed>=315')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/car_data?driver_number=55&session_key=9159&speed>=315')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/car_data?driver_number=55&session_key=9159&speed>=315",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "brake": 0,\
    "date": "2023-09-15T13:08:19.923000+00:00",\
    "driver_number": 55,\
    "drs": 12,\
    "meeting_key": 1219,\
    "n_gear": 8,\
    "rpm": 11141,\
    "session_key": 9159,\
    "speed": 315,\
    "throttle": 99\
  },\
  {\
    "brake": 100,\
    "date": "2023-09-15T13:35:41.808000+00:00",\
    "driver_number": 55,\
    "drs": 8,\
    "meeting_key": 1219,\
    "n_gear": 8,\
    "rpm": 11023,\
    "session_key": 9159,\
    "speed": 315,\
    "throttle": 57\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/car\_data?driver\_number=55&session\_key=9159&speed>=315](https://api.openf1.org/v1/car_data?driver_number=55&session_key=9159&speed%3E=315)

### Attributes

| Name | Description |
| --- | --- |
| brake | Whether the brake pedal is pressed (`100`) or not (`0`). |
| date | The UTC date and time, in ISO 8601 format. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| drs | The Drag Reduction System (DRS) status (see mapping table below). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| n\_gear | Current gear selection, ranging from 1 to 8. `0` indicates neutral or no gear engaged. |
| rpm | Revolutions per minute of the engine. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| speed | Velocity of the car in km/h. |
| throttle | Percentage of maximum engine power being used. |

Below is a table that correlates DRS values to its supposed interpretation
(from [FastF1](https://github.com/theOehrly/Fast-F1/blob/317bacf8c61038d7e8d0f48165330167702b349f/fastf1/_api.py#L863)).

| DRS value | Interpretation |
| --- | --- |
| 0 | DRS off |
| 1 | DRS off |
| 2 | ? |
| 3 | ? |
| 8 | Detected, eligible once in activation zone |
| 9 | ? |
| 10 | DRS on |
| 12 | DRS on |
| 14 | DRS on |

## Drivers championship (beta)

Provides championship standings for drivers. Only available for race sessions.

```
curl "https://api.openf1.org/v1/championship_drivers?session_key=9839&driver_number=4&driver_number=81"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/championship_drivers?session_key=9839&driver_number=4&driver_number=81')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/championship_drivers?session_key=9839&driver_number=4&driver_number=81')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/championship_drivers?session_key=9839&driver_number=4&driver_number=81",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "driver_number": 4,\
    "meeting_key": 1276,\
    "points_current": 423,\
    "points_start": 408,\
    "position_current": 1,\
    "position_start": 1,\
    "session_key": 9839\
  },\
  {\
    "driver_number": 81,\
    "meeting_key": 1276,\
    "points_current": 410,\
    "points_start": 392,\
    "position_current": 3,\
    "position_start": 3,\
    "session_key": 9839\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/championship\_drivers?session\_key=9839&driver\_number=4&driver\_number=81](https://api.openf1.org/v1/championship_drivers?session_key=9839&driver_number=4&driver_number=81)

### Attributes

| Name | Description |
| --- | --- |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| points\_current | Championship points during/after the race (depends on call timing). |
| points\_start | Championship points before the race started. |
| position\_current | Championship position during/after the race (depends on call timing). |
| position\_start | Championship position before the race started. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Teams championship (beta)

Provides championship standings for teams. Only available for race sessions.

```
curl "https://api.openf1.org/v1/championship_teams?session_key=9839&team_name=McLaren"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/championship_teams?session_key=9839&team_name=McLaren')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/championship_teams?session_key=9839&team_name=McLaren')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/championship_teams?session_key=9839&team_name=McLaren",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "meeting_key": 1276,\
    "points_current": 833,\
    "points_start": 800,\
    "position_current": 1,\
    "position_start": 1,\
    "session_key": 9839,\
    "team_name": "McLaren"\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/championship\_teams?session\_key=9839&team\_name=McLaren](https://api.openf1.org/v1/championship_teams?session_key=9839&team_name=McLaren)

### Attributes

| Name | Description |
| --- | --- |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| points\_current | Championship points during/after the race (depends on call timing). |
| points\_start | Championship points before the race started. |
| position\_current | Championship position during/after the race (depends on call timing). |
| position\_start | Championship position before the race started. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| team\_name | The name of the team. |

## Drivers

Retrieve detailed information about the drivers participating in a specific session.

```
curl "https://api.openf1.org/v1/drivers?driver_number=1&session_key=9158"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/drivers?driver_number=1&session_key=9158')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/drivers?driver_number=1&session_key=9158')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch("https://api.openf1.org/v1/drivers?driver_number=1&session_key=9158")
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "broadcast_name": "M VERSTAPPEN",\
    "driver_number": 1,\
    "first_name": "Max",\
    "full_name": "Max VERSTAPPEN",\
    "headshot_url": "https://www.formula1.com/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png",\
    "last_name": "Verstappen",\
    "meeting_key": 1219,\
    "name_acronym": "VER",\
    "session_key": 9158,\
    "team_colour": "3671C6",\
    "team_name": "Red Bull Racing"\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/drivers?driver\_number=1&session\_key=9158](https://api.openf1.org/v1/drivers?driver_number=1&session_key=9158)

### Attributes

| Name | Description |
| --- | --- |
| broadcast\_name | The driver's name, as displayed on TV. |
| country\_code (deprecated) | A code that uniquely identifies the country. This field will be removed at the end of the 2026 season. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| first\_name | The driver's first name. |
| full\_name | The driver's full name. |
| headshot\_url | URL of the driver's face photo. |
| last\_name | The driver's last name. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| name\_acronym | Three-letter acronym of the driver's name. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| team\_colour | The hexadecimal color value (RRGGBB) of the driver's team. |
| team\_name | Name of the driver's team. |

## Intervals

Fetches real-time interval data between drivers and their gap to the race leader.
Available during races only, with updates approximately every 4 seconds.

```
curl "https://api.openf1.org/v1/intervals?session_key=9165&interval>0&interval<0.005"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/intervals?session_key=9165&interval>0&interval<0.005')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/intervals?session_key=9165&interval>0&interval<0.005')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/intervals?session_key=9165&interval>0&interval<0.005",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "date": "2023-09-17T13:31:02.395000+00:00",\
    "driver_number": 1,\
    "gap_to_leader": 41.019,\
    "interval": 0.003,\
    "meeting_key": 1219,\
    "session_key": 9165\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/intervals?session\_key=9165&interval<0.005](https://api.openf1.org/v1/intervals?session_key=9165&interval%3C0.005)

### Attributes

| Name | Description |
| --- | --- |
| date | The UTC date and time, in ISO 8601 format. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| gap\_to\_leader | The time gap to the race leader in seconds, `+1 LAP` if lapped, or `null` for the race leader. |
| interval | The time gap to the car ahead in seconds, `+1 LAP` if lapped, or `null` for the race leader. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Laps

Provides detailed information about individual laps.

```
curl "https://api.openf1.org/v1/laps?session_key=9161&driver_number=63&lap_number=8"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/laps?session_key=9161&driver_number=63&lap_number=8')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/laps?session_key=9161&driver_number=63&lap_number=8')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/laps?session_key=9161&driver_number=63&lap_number=8",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "date_start": "2023-09-16T13:59:07.606000+00:00",\
    "driver_number": 63,\
    "duration_sector_1": 26.966,\
    "duration_sector_2": 38.657,\
    "duration_sector_3": 26.12,\
    "i1_speed": 307,\
    "i2_speed": 277,\
    "is_pit_out_lap": false,\
    "lap_duration": 91.743,\
    "lap_number": 8,\
    "meeting_key": 1219,\
    "segments_sector_1": [2049, 2049, 2049, 2051, 2049, 2051, 2049, 2049],\
    "segments_sector_2": [2049, 2049, 2049, 2049, 2049, 2049, 2049, 2049],\
    "segments_sector_3": [2048, 2048, 2048, 2048, 2048, 2064, 2064, 2064],\
    "session_key": 9161,\
    "st_speed": 298\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/laps?session\_key=9161&driver\_number=63&lap\_number=8](https://api.openf1.org/v1/laps?session_key=9161&driver_number=63&lap_number=8)

### Attributes

| Name | Description |
| --- | --- |
| date\_start | The UTC starting date and time, in ISO 8601 format. This date is approximate. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| duration\_sector\_1 | The time taken, in seconds, to complete the first sector of the lap. |
| duration\_sector\_2 | The time taken, in seconds, to complete the second sector of the lap. |
| duration\_sector\_3 | The time taken, in seconds, to complete the third sector of the lap. |
| i1\_speed | The speed of the car, in km/h, at the first intermediate point on the track. |
| i2\_speed | The speed of the car, in km/h, at the second intermediate point on the track. |
| is\_pit\_out\_lap | A boolean value indicating whether the lap is an "out lap" from the pit (`true` if it is, `false` otherwise). |
| lap\_duration | The total time taken, in seconds, to complete the entire lap. |
| lap\_number | The sequential number of the lap within the session (starts at 1). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| segments\_sector\_1 | A list of values representing the "mini-sectors" within the first sector (see mapping table below). |
| segments\_sector\_2 | A list of values representing the "mini-sectors" within the second sector (see mapping table below). |
| segments\_sector\_3 | A list of values representing the "mini-sectors" within the third sector (see mapping table below). |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| st\_speed | The speed of the car, in km/h, at the speed trap, which is a specific point on the track where the highest speeds are usually recorded. |

Below is a table that correlates segment values to their meaning.

| Value | Color |
| --- | --- |
| 0 | not available |
| 2048 | yellow sector |
| 2049 | green sector |
| 2050 | ? |
| 2051 | purple sector |
| 2052 | ? |
| 2064 | pitlane |
| 2068 | ? |

Segments are not available during races.
Also, The segment values may not always align perfectly with the colors shown on TV, for unknown reasons.

## Location

The approximate location of the cars on the circuit, at a sample rate of about 3.7 Hz.
Useful for gauging their progress along the track, but lacks details about lateral placement — i.e. whether
the car is on the left or right side of the track. The origin point (0, 0, 0) appears to be arbitrary
and not tied to any specific location on the track.

```
curl "https://api.openf1.org/v1/location?session_key=9161&driver_number=81&date>2023-09-16T13:03:35.200&date<2023-09-16T13:03:35.800"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/location?session_key=9161&driver_number=81&date>2023-09-16T13:03:35.200&date<2023-09-16T13:03:35.800')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/location?session_key=9161&driver_number=81&date>2023-09-16T13:03:35.200&date<2023-09-16T13:03:35.800')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/location?session_key=9161&driver_number=81&date>2023-09-16T13:03:35.200&date<2023-09-16T13:03:35.800",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "date": "2023-09-16T13:03:35.292000+00:00",\
    "driver_number": 81,\
    "meeting_key": 1219,\
    "session_key": 9161,\
    "x": 567,\
    "y": 3195,\
    "z": 187\
  },\
  {\
    "date": "2023-09-16T13:03:35.752000+00:00",\
    "driver_number": 81,\
    "meeting_key": 1219,\
    "session_key": 9161,\
    "x": 489,\
    "y": 3403,\
    "z": 186\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/location?session\_key=9161&driver\_number=81&date>2023-09-16T13:03:35.200&date<2023-09-16T13:03:35.800](https://api.openf1.org/v1/location?session_key=9161&driver_number=81&date%3E2023-09-16T13:03:35.200&date%3C2023-09-16T13:03:35.800)

### Attributes

| Name | Description |
| --- | --- |
| date | The UTC date and time, in ISO 8601 format. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| x | The 'x' value in a 3D Cartesian coordinate system representing the current approximate location of the car on the track. |
| y | The 'y' value in a 3D Cartesian coordinate system representing the current approximate location of the car on the track. |
| z | The 'z' value in a 3D Cartesian coordinate system representing the current approximate location of the car on the track. |

## Meetings

Provides information about meetings.
A meeting refers to a Grand Prix or testing weekend and usually includes multiple sessions (practice, qualifying, race, ...).
Meetings are updated every day at midnight UTC.

```
curl "https://api.openf1.org/v1/meetings?year=2026&country_name=Singapore"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/meetings?year=2026&country_name=Singapore')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/meetings?year=2026&country_name=Singapore')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch("https://api.openf1.org/v1/meetings?year=2026&country_name=Singapore")
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "circuit_key": 61,\
    "circuit_info_url": "https://api.multiviewer.app/api/v1/circuits/61/2026",\
    "circuit_image": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/Singapore%20carbon.png",\
    "circuit_short_name": "Singapore",\
    "circuit_type": "Temporary - Street",\
    "country_code": "SGP",\
    "country_flag": "https://media.formula1.com/content/dam/fom-website/2018-redesign-assets/Flags%2016x9/singapore-flag.png",\
    "country_key": 157,\
    "country_name": "Singapore",\
    "date_end": "2026-10-11T14:00:00+00:00",\
    "date_start": "2026-10-09T09:30:00+00:00",\
    "gmt_offset": "08:00:00",\
    "is_cancelled": false,\
    "location": "Marina Bay",\
    "meeting_key": 1296,\
    "meeting_name": "Singapore Grand Prix",\
    "meeting_official_name": "FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026",\
    "year": 2026\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/meetings?year=2026&country\_name=Singapore](https://api.openf1.org/v1/meetings?year=2026&country_name=Singapore)

### Attributes

| Name | Description |
| --- | --- |
| circuit\_key | The unique identifier for the circuit where the event takes place. |
| circuit\_image | An image of the circuit. |
| circuit\_info\_url | A URL to a JSON containing detailed circuit info. See [FastF1 documentation](https://docs.fastf1.dev/api_reference/circuit_info.html) for details. Data provided by [MultiViewer](https://multiviewer.app/). |
| circuit\_short\_name | The short or common name of the circuit where the event takes place. |
| circuit\_type | The type of the circuit ("Permanent", "Temporary - Street", or "Temporary - Road") |
| country\_code | A code that uniquely identifies the country. |
| country\_flag | An image of the country flag. |
| country\_key | The unique identifier for the country where the event takes place. |
| country\_name | The full name of the country where the event takes place. |
| date\_end | The UTC ending date and time, in ISO 8601 format. |
| date\_start | The UTC starting date and time, in ISO 8601 format. |
| gmt\_offset | The difference in hours and minutes between local time at the location of the event and Greenwich Mean Time (GMT). |
| is\_cancelled | A boolean indicating whether the meeting has been cancelled. |
| location | The city or geographical location where the event takes place. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| meeting\_name | The name of the meeting. |
| meeting\_official\_name | The official name of the meeting. |
| year | The year the event takes place. |

## Overtakes

Provides information about overtakes.
An overtake refers to one driver (the overtaking driver) exchanging positions with another driver (the overtaken driver). This includes both on-track passes and position changes resulting from pit stops or post-race penalties.
This data is only available during races and may be incomplete.

```
curl "https://api.openf1.org/v1/overtakes?session_key=9636&overtaking_driver_number=63&overtaken_driver_number=4&position=1"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/overtakes?session_key=9636&overtaking_driver_number=63&overtaken_driver_number=4&position=1')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/overtakes?session_key=9636&overtaking_driver_number=63&overtaken_driver_number=4&position=1')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/overtakes?session_key=9636&overtaking_driver_number=63&overtaken_driver_number=4&position=1",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "date": "2024-11-03T15:50:07.565000+00:00",\
    "meeting_key": 1249,\
    "overtaken_driver_number": 4,\
    "overtaking_driver_number": 63,\
    "position": 1,\
    "session_key": 9636\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/overtakes?session\_key=9636&overtaking\_driver\_number=63&overtaken\_driver\_number=4&position=1](https://api.openf1.org/v1/overtakes?session_key=9636&overtaking_driver_number=63&overtaken_driver_number=4&position=1)

### Attributes

| Name | Description |
| --- | --- |
| date | The UTC date and time, in ISO 8601 format. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| overtaken\_driver\_number | The unique number assigned to the overtaken F1 driver (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| overtaking\_driver\_number | The unique number assigned to the overtaking F1 driver (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| position | The position of the overtaking F1 driver after the overtake was completed (starts at 1). |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Pit

Provides information about cars going through the pit lane.

```
curl "https://api.openf1.org/v1/pit?session_key=9877&stop_duration<2.3"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/pit?session_key=9877&stop_duration<2.3')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/pit?session_key=9877&stop_duration<2.3')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch("https://api.openf1.org/v1/pit?session_key=9877&stop_duration<2.3")
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "date": "2025-10-26T20:46:37.358000+00:00",\
    "driver_number": 16,\
    "lane_duration": 22.215,\
    "lap_number": 31,\
    "meeting_key": 1272,\
    "pit_duration": 22.215,\
    "session_key": 9877,\
    "stop_duration": 2.2\
  },\
  {\
    "date": "2025-10-26T21:09:49.689000+00:00",\
    "driver_number": 81,\
    "lane_duration": 22.159,\
    "lap_number": 47,\
    "meeting_key": 1272,\
    "pit_duration": 22.159,\
    "session_key": 9877,\
    "stop_duration": 2.1\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/pit?session\_key=9877&stop\_duration<2.3](https://api.openf1.org/v1/pit?session_key=9877&stop_duration%3C2.3)

### Attributes

| Name | Description |
| --- | --- |
| date | The UTC date and time, in ISO 8601 format. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| lane\_duration | The time spent in the pit lane, in seconds. |
| lap\_number | The sequential number of the lap within the session (starts at 1). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| pit\_duration (deprecated) | Same as 'lane\_duration'. This field will be removed at the end of the 2026 season. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| stop\_duration | The stationary pit stop time, in seconds. This field is only available from the 2024 US GP onwards. |

## Position

Provides driver positions throughout a session, including initial
placement and subsequent changes.

```
curl "https://api.openf1.org/v1/position?meeting_key=1217&driver_number=40&position<=3"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/position?meeting_key=1217&driver_number=40&position<=3')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/position?meeting_key=1217&driver_number=40&position<=3')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/position?meeting_key=1217&driver_number=40&position<=3",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "date": "2023-08-26T09:30:47.199000+00:00",\
    "driver_number": 40,\
    "meeting_key": 1217,\
    "position": 2,\
    "session_key": 9144\
  },\
  {\
    "date": "2023-08-26T09:35:51.477000+00:00",\
    "driver_number": 40,\
    "meeting_key": 1217,\
    "position": 3,\
    "session_key": 9144\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/position?meeting\_key=1217&driver\_number=40&position<=3](https://api.openf1.org/v1/position?meeting_key=1217&driver_number=40&position%3C=3)

### Attributes

| Name | Description |
| --- | --- |
| date | The UTC date and time, in ISO 8601 format. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| position | Position of the driver (starts at 1). |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Race control

Provides information about race control (session status, racing incidents, flags, safety car, ...).

```
curl "https://api.openf1.org/v1/race_control?flag=BLACK AND WHITE&driver_number=1&date>=2023-01-01&date<2023-09-01"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/race_control?flag=BLACK AND WHITE&driver_number=1&date>=2023-01-01&date<2023-09-01')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/race_control?flag=BLACK AND WHITE&driver_number=1&date>=2023-01-01&date<2023-09-01')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/race_control?flag=BLACK AND WHITE&driver_number=1&date>=2023-01-01&date<2023-09-01",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "category": "Flag",\
    "date": "2023-06-04T14:21:01+00:00",\
    "driver_number": 1,\
    "flag": "BLACK AND WHITE",\
    "lap_number": 59,\
    "meeting_key": 1211,\
    "message": "BLACK AND WHITE FLAG FOR CAR 1 (VER) - TRACK LIMITS",\
    "qualifying_phase": null,\
    "scope": "Driver",\
    "sector": null,\
    "session_key": 9102\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/race\_control?flag=BLACK AND WHITE&driver\_number=1&date>=2023-01-01&date<2023-09-01](https://api.openf1.org/v1/race_control?flag=BLACK%20AND%20WHITE&driver_number=1&date%3E=2023-01-01&date%3C2023-09-01)

### Attributes

| Name | Description |
| --- | --- |
| category | The category of the event (`SessionStatus`, `CarEvent`, `Drs`, `Flag`, `SafetyCar`, ...). |
| date | The UTC date and time, in ISO 8601 format. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| flag | Type of flag displayed (`GREEN`, `YELLOW`, `DOUBLE YELLOW`, `CHEQUERED`, ...). |
| lap\_number | The sequential number of the lap within the session (starts at 1), in a race. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| message | Description of the event or action. |
| qualifying\_phase | The specific phase (`1`, `2`, or `3`) if the session is a qualifying session. |
| scope | The scope of the event (`Track`, `Driver`, `Sector`, ...). |
| sector | Segment ("mini-sector") of the track where the event occurred? (starts at 1). |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Sessions

Provides information about sessions.
A session refers to a distinct period of track activity during a Grand Prix or testing weekend (practice, qualifying, sprint, race, ...).
Sessions are updated every day at midnight UTC.

```
curl "https://api.openf1.org/v1/sessions?country_name=Belgium&session_name=Sprint%20Qualifying&year=2023"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/sessions?country_name=Belgium&session_name=Sprint%20Qualifying&year=2023')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/sessions?country_name=Belgium&session_name=Sprint%20Qualifying&year=2023')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/sessions?country_name=Belgium&session_name=Sprint%20Qualifying&year=2023",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "circuit_key": 7,\
    "circuit_short_name": "Spa-Francorchamps",\
    "country_code": "BEL",\
    "country_key": 16,\
    "country_name": "Belgium",\
    "date_end": "2023-07-29T15:35:00+00:00",\
    "date_start": "2023-07-29T15:05:00+00:00",\
    "gmt_offset": "02:00:00",\
    "is_cancelled": false,\
    "location": "Spa-Francorchamps",\
    "meeting_key": 1216,\
    "session_key": 9140,\
    "session_name": "Sprint Qualifying",\
    "session_type": "Sprint Qualifying",\
    "year": 2023\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/sessions?country\_name=Belgium&session\_name=Sprint%20Qualifying&year=2023](https://api.openf1.org/v1/sessions?country_name=Belgium&session_name=Sprint%20Qualifying&year=2023)

### Attributes

| Name | Description |
| --- | --- |
| circuit\_key | The unique identifier for the circuit where the event takes place. |
| circuit\_short\_name | The short or common name of the circuit where the event takes place. |
| country\_code | A code that uniquely identifies the country. |
| country\_key | The unique identifier for the country where the event takes place. |
| country\_name | The full name of the country where the event takes place. |
| date\_end | The UTC ending date and time, in ISO 8601 format. |
| date\_start | The UTC starting date and time, in ISO 8601 format. |
| gmt\_offset | The difference in hours and minutes between local time at the location of the event and Greenwich Mean Time (GMT). |
| is\_cancelled | A boolean indicating whether the session has been cancelled. |
| location | The city or geographical location where the event takes place. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| session\_name | The name of the session (`Practice 1`, `Qualifying`, `Race`, ...). |
| session\_type | The type of the session (`Practice`, `Qualifying`, `Race`, ...). |
| year | The year the event takes place. |

## Session result

Provides standings after a session. This data becomes available a few minutes after the official results are published on the official Formula 1 website.

```
curl "https://api.openf1.org/v1/session_result?session_key=7782&position%3C=3"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/session_result?session_key=7782&position%3C=3')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/session_result?session_key=7782&position%3C=3')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch("https://api.openf1.org/v1/session_result?session_key=7782&position%3C=3")
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "dnf": false,\
    "dns": false,\
    "dsq": false,\
    "driver_number": 1,\
    "duration": 77.565,\
    "gap_to_leader": 0,\
    "number_of_laps": 24,\
    "meeting_key": 1143,\
    "position": 1,\
    "session_key": 7782\
  },\
  {\
    "dnf": false,\
    "dns": false,\
    "dsq": false,\
    "driver_number": 14,\
    "duration": 77.727,\
    "gap_to_leader": 0.162,\
    "number_of_laps": 26,\
    "meeting_key": 1143,\
    "position": 2,\
    "session_key": 7782\
  },\
  {\
    "dnf": false,\
    "dns": false,\
    "dsq": false,\
    "driver_number": 31,\
    "duration": 77.938,\
    "gap_to_leader": 0.373,\
    "number_of_laps": 23,\
    "meeting_key": 1143,\
    "position": 3,\
    "session_key": 7782\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/session\_result?session\_key=7782&position<=3](https://api.openf1.org/v1/session_result?session_key=7782&position%3C=3)

### Attributes

| Name | Description |
| --- | --- |
| dnf | Indicates whether the driver _Did Not Finish_ the race. This can be `true` only for qualifying and race sessions. |
| dns | Indicates whether the driver _Did Not Start_ the race. This can be `true` only for qualifying and race sessions. |
| dsq | Indicates whether the driver was disqualified. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| duration | Either the best lap time (for practice or qualifying), or the total race time (for races), in seconds. In qualifying, this is an array of three values for Q1, Q2, and Q3. |
| gap\_to\_leader | The time gap to the session leader in seconds, or `+N LAP(S)` if the driver was lapped. In qualifying, this is an array of three values for Q1, Q2, and Q3. |
| number\_of\_laps | Total number of laps completed during the session. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| position | The driver’s final position at the end of the session. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Starting grid

Provides the starting grid for the upcoming race. This data becomes available a few minutes after the official results are published on the official Formula 1 website.

```
curl "https://api.openf1.org/v1/starting_grid?session_key=7783&position%3C=3"
```

```
from urllib.request import urlopen
import json

response = urlopen("https://api.openf1.org/v1/starting_grid?session_key=7783&position%3C=3")
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET("https://api.openf1.org/v1/starting_grid?session_key=7783&position%3C=3")
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch("https://api.openf1.org/v1/starting_grid?session_key=7783&position%3C=3")
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "position": 1,\
    "driver_number": 1,\
    "lap_duration": 76.732,\
    "meeting_key": 1143,\
    "session_key": 7783\
  },\
  {\
    "position": 2,\
    "driver_number": 63,\
    "lap_duration": 76.968,\
    "meeting_key": 1143,\
    "session_key": 7783\
  },\
  {\
    "position": 3,\
    "driver_number": 44,\
    "lap_duration": 77.104,\
    "meeting_key": 1143,\
    "session_key": 7783\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/starting\_grid?session\_key=7783&position<=3](https://api.openf1.org/v1/starting_grid?session_key=7783&position%3C=3)

### Attributes

| Name | Description |
| --- | --- |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| lap\_duration | Duration, in seconds, of the qualifying lap. |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| position | Position on the grid. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Stints

Provides information about individual stints.
A stint refers to a period of continuous driving by a driver during a session.

```
curl "https://api.openf1.org/v1/stints?session_key=9165&tyre_age_at_start>=3"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/stints?session_key=9165&tyre_age_at_start>=3')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/stints?session_key=9165&tyre_age_at_start>=3')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch("https://api.openf1.org/v1/stints?session_key=9165&tyre_age_at_start>=3")
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "compound": "SOFT",\
    "driver_number": 16,\
    "lap_end": 20,\
    "lap_start": 1,\
    "meeting_key": 1219,\
    "session_key": 9165,\
    "stint_number": 1,\
    "tyre_age_at_start": 3\
  },\
  {\
    "compound": "SOFT",\
    "driver_number": 20,\
    "lap_end": 62,\
    "lap_start": 44,\
    "meeting_key": 1219,\
    "session_key": 9165,\
    "stint_number": 3,\
    "tyre_age_at_start": 3\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/stints?session\_key=9165&tyre\_age\_at\_start>=3](https://api.openf1.org/v1/stints?session_key=9165&tyre_age_at_start%3E=3)

### Attributes

| Name | Description |
| --- | --- |
| compound | The specific compound of tyre used during the stint (`SOFT`, `MEDIUM`, `HARD`, ...). |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| lap\_end | Number of the last completed lap in this stint. |
| lap\_start | Number of the initial lap in this stint (starts at 1). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| stint\_number | The sequential number of the stint within the session (starts at 1). |
| tyre\_age\_at\_start | The age of the tyres at the start of the stint, in laps completed. |

## Team radio

Provides a collection of radio exchanges between Formula 1 drivers and their respective teams during sessions.
Please note that only a limited selection of communications are included, not the complete record of radio interactions.

```
curl "https://api.openf1.org/v1/team_radio?session_key=9158&driver_number=11"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/team_radio?session_key=9158&driver_number=11')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/team_radio?session_key=9158&driver_number=11')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch("https://api.openf1.org/v1/team_radio?session_key=9158&driver_number=11")
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "date": "2023-09-15T09:40:43.005000+00:00",\
    "driver_number": 11,\
    "meeting_key": 1219,\
    "recording_url": "https://livetiming.formula1.com/static/2023/2023-09-17_Singapore_Grand_Prix/2023-09-15_Practice_1/TeamRadio/SERPER01_11_20230915_104008.mp3",\
    "session_key": 9158\
  },\
  {\
    "date": "2023-09-15T10:32:47.325000+00:00",\
    "driver_number": 11,\
    "meeting_key": 1219,\
    "recording_url": "https://livetiming.formula1.com/static/2023/2023-09-17_Singapore_Grand_Prix/2023-09-15_Practice_1/TeamRadio/SERPER01_11_20230915_113201.mp3",\
    "session_key": 9158\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/team\_radio?session\_key=9158&driver\_number=11](https://api.openf1.org/v1/team_radio?session_key=9158&driver_number=11)

### Attributes

| Name | Description |
| --- | --- |
| date | The UTC date and time, in ISO 8601 format. |
| driver\_number | The unique number assigned to an F1 driver for the season (cf. [Wikipedia](https://en.wikipedia.org/wiki/List_of_Formula_One_driver_numbers#Formula_One_driver_numbers)). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| recording\_url | URL of the radio recording. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |

## Weather

The weather over the track, updated every minute.

```
curl "https://api.openf1.org/v1/weather?meeting_key=1208&wind_direction>=130&track_temperature>=52"
```

```
from urllib.request import urlopen
import json

response = urlopen('https://api.openf1.org/v1/weather?meeting_key=1208&wind_direction>=130&track_temperature>=52')
data = json.loads(response.read().decode('utf-8'))
print(data)

# If you want, you can import the results in a DataFrame (you need to install the `pandas` package first)
# import pandas as pd
# df = pd.DataFrame(data)
```

```
# If needed, install libraries
# install.packages('httr')
# install.packages('jsonlite')

library(httr)
library(jsonlite)

response <- GET('https://api.openf1.org/v1/weather?meeting_key=1208&wind_direction>=130&track_temperature>=52')
parsed_data <- fromJSON(content(response, 'text'))
print(parsed_data)

# If you want, you can import the results in a DataFrame
# df <- do.call(rbind, lapply(parsed_data, data.frame, stringsAsFactors = FALSE))
# df <- as.data.frame(t(as.matrix(df)))
```

```
fetch(
  "https://api.openf1.org/v1/weather?meeting_key=1208&wind_direction>=130&track_temperature>=52",
)
  .then((response) => response.json())
  .then((jsonContent) => console.log(jsonContent));
```

> Output:

```
[\
  {\
    "air_temperature": 27.8,\
    "date": "2023-05-07T18:42:25.233000+00:00",\
    "humidity": 58,\
    "meeting_key": 1208,\
    "pressure": 1018.7,\
    "rainfall": 0,\
    "session_key": 9078,\
    "track_temperature": 52.5,\
    "wind_direction": 136,\
    "wind_speed": 2.4\
  }\
]
```

### Sample URL

[https://api.openf1.org/v1/weather?meeting\_key=1208&wind\_direction>=130&track\_temperature>=52](https://api.openf1.org/v1/weather?meeting_key=1208&wind_direction%3E=130&track_temperature%3E=52)

### Attributes

| Name | Description |
| --- | --- |
| air\_temperature | Air temperature (°C). |
| date | The UTC date and time, in ISO 8601 format. |
| humidity | Relative humidity (%). |
| meeting\_key | The unique identifier for the meeting. Use `latest` to identify the latest or current meeting. |
| pressure | Air pressure (mbar). |
| rainfall | Whether there is rainfall. |
| session\_key | The unique identifier for the session. Use `latest` to identify the latest or current session. |
| track\_temperature | Track temperature (°C). |
| wind\_direction | Wind direction (°), from 0° to 359°. |
| wind\_speed | Wind speed (m/s). |

# Data filtering

Refine your query by including parameters directly in the URL.

Results can be filtered by any attribute, except arrays.

**Example**

To fetch pit-out laps for driver number 55 (Carlos Sainz) that last at least 2 minutes, use:
[https://api.openf1.org/v1/laps?session\_key=9222&driver\_number=55&is\_pit\_out\_lap=true&lap\_duration>=120](https://api.openf1.org/v1/laps?session_key=9222&driver_number=55&is_pit_out_lap=true&lap_duration%3E%3D120)

## Time-Based Filtering

You can narrow down your results using time ranges.

**Example**

To get all sessions in September 2023, use:
[https://api.openf1.org/v1/sessions?date\_start>=2023-09-01&date\_end<=2023-09-30](https://api.openf1.org/v1/sessions?date_start%3E%3D2023-09-01&date_end%3C%3D2023-09-30)

The API supports a wide range of date formats (those compatible with Python's `dateutil.parser.parse` method). Examples include:

- "2021-09-10"
- "2021-09-10T14:30:20"
- "2021-09-10T14:30:20+00:00"
- "09/10/2021"
- "09-10-2021"
- "Fri Sep 10 14:30:20 2021"
- "10 September 2021"
- "Sep 10, 2021"
- "2021-09-10 14:30:20 UTC"
- "2021-09-10 14:30:20+00:00"
- "2021-09-10 14:30:20 EST"
- ...and many more.

# CSV Format

To receive your query results in CSV format instead of the default JSON, simply append the query parameter `csv=true` to your URL. This feature is particularly handy to import the data into spreadsheet software like Microsoft Excel.

**Example**

To get all sessions for the year 2023 in CSV format, use the following URL:
[https://api.openf1.org/v1/sessions?year=2023&csv=true](https://api.openf1.org/v1/sessions?year=2023&csv=true)

# Tutorials

- [Creating an interactive strategy dashboard with Python](https://github.com/bordanattila/OpenF1_tutorial), by [@bordanattila](https://github.com/bordanattila)
- [Streaming live data with OpenF1](https://openf1.org/auth.html)

Have a great OpenF1 tutorial to share? [We’d love to feature it](https://github.com/br-g/openf1/blob/main/CONTRIBUTING.md)!

# Community and Support

For community-driven questions or feedback, we encourage you to participate in our [Github Discussions](https://github.com/br-g/openf1/discussions). If you encounter any bugs or issues, please report them by creating a new issue on [our Github repository](https://github.com/br-g/openf1/issues).

For specialized inquiries, feel free to [reach out to us directly](https://openf1.org/contact). However, for general support questions, please use the [Github Discussions](https://github.com/br-g/openf1/discussions) platform to ensure that the entire community can benefit from the answers.

# Contributing

OpenF1's mission is to democratize Formula 1 data by making it open and accessible to everyone.

We welcome all contributions that help advance this goal!

To get started, please review our [contribution guidelines](https://github.com/br-g/openf1/blob/main/CONTRIBUTING.md).

### Contributors

- [@br-g](https://github.com/br-g)
- [@JeffreyJPZ](https://github.com/JeffreyJPZ)
- [@jetpacktuxedo](https://github.com/jetpacktuxedo)
- [@PrestonHager](https://github.com/PrestonHager)
- [@eepzii](https://github.com/eepzii)
- [@Nik-code](https://github.com/Nik-code)
- [@bordanattila](https://github.com/bordanattila)
- [@rjwhitmer](https://github.com/rjwhitmer)