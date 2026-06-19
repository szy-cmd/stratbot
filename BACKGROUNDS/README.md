# Custom Racetrack Backgrounds for 3D Model Viewer (Stratbot)

Drop your ultra high-res 360/equirectangular panorama images here.

Current:
- SUNNY.png : clear
- CLOUDY-GPT.png : overcast
- RAINY-GPT.png : rainy

To use:
- Copy to frontend/public/backgrounds/ (and dist/backgrounds/)
- Paths are in WEATHER_HDRI in CarCustomizer.jsx (edit if names change)
- USER_HDRI_OVERRIDES for special names

Tuning (in WEATHER_PRESETS):
- bgTint: controls how much the background pano is darkened (e.g. #e8e8e8 is light, lower the hex for darker)
- ambient / sun / accent intensities + colors: balance the car lighting vs bg (increase ambient to lift dark cars, rim/accent to make car pop)
- envIntensity: strength of HDRI reflections/lighting on the car
- fog: distance fade

Extra car-only shine/glimmer lights:
- Added several high-intensity point lights (key, top, rims, accents) positioned around the car.
- These create strong specular highlights and glints on paint, carbon, glass and chrome without affecting the HDRI background sphere (unlit BasicMaterial).
- For rainy ONLY: car is made much brighter with high ambient (2.8), sun (1.8), accent (1.2), envIntensity (2.5), and 4x mult on the extra shine lights. Rainy visual BG is a solid dark color (#0f1a28, not completely black, tunable via rainyBgColor in presets) - do NOT use the HDRI image as visual background. But KEEP the HDRI texture loaded and fed ONLY to Environment for car reflections/lighting (wet rainy look on car). Other weathers use HDRI pano as BG.
- For cloudy: boosted too.
- Positions are fixed relative to the centered car; tweak the hardcoded positions/intensities/colors in WeatherLights if you want different angles or more/less glimmer.

No visible floor (invisible shadow receiver only for grounding shadows).

Old generated images removed.