# CodVis UI

This folder contains the frontend for the code visualizer.

Open `index.html` through the Go server origin so the browser can fetch the snapshot APIs without CORS issues.

The UI expects these backend endpoints:
- `GET /code`
- `GET /current`
- `POST /next`
- `POST /prev`
- `POST /jump/0`
