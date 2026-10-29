# DeskOS Hub

The brain of the DeskOS office-automation system. Ingests vision events over REST, persists them to Postgres, and dispatches them to a strategy-based scene engine that drives one or more actuators.

Current state: skeleton with a `MockActuator` that logs instead of doing anything physical. Real `ShellyActuator`, `WolActuator`, etc. are added later as sibling implementations of the `Actuator` interface.

## Prerequisites

- JDK 21
- Maven 3.9+ (or just use IntelliJ, which bundles it)
- Docker Desktop (for Postgres)

Start Postgres once:

```powershell
docker run -d --name deskos-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=deskos -p 5432:5432 postgres:16
```

Subsequent starts: `docker start deskos-pg`.

## Run

```powershell
mvn spring-boot:run
```

The service listens on `http://localhost:8080`.

## Try it

Trigger a morning arrival (fires `MorningArrivalScene` if the clock is Mon–Fri 7–12):

```powershell
curl -X POST http://localhost:8080/events/vision `
     -H "Content-Type: application/json" `
     -d '{\"eventType\":\"arrived\",\"personName\":\"kostas\",\"confidence\":0.72}'
```

Trigger a leave:

```powershell
curl -X POST http://localhost:8080/events/vision `
     -H "Content-Type: application/json" `
     -d '{\"eventType\":\"left\"}'
```

List saved events:

```powershell
curl http://localhost:8080/events/vision
```

Health:

```powershell
curl http://localhost:8080/actuator/health
```

## Tests

```powershell
mvn test
```

Tests use an in-memory H2 database via the `test` Spring profile — no Postgres container needed.

## Architecture

```
POST /events/vision
        │
        ▼
EventController ──► VisionEventRepository (Postgres)
        │
        ▼
SceneService ──► picks first matching SceneStrategy
                       │
                       ├─ MorningArrivalScene
                       ├─ EveningArrivalScene
                       └─ LeftScene
                              │
                              ▼
                         List<Actuator>
                              │
                              └─ MockActuator (logs only, for now)
```

### Adding a new actuator later

Just add a `@Component` that implements `Actuator`. Spring auto-discovers it and every scene starts fanning out to it alongside the existing ones. No scene changes needed.

```java
@Component
public class ShellyActuator implements Actuator { ... }
```

### Adding a new scene later

Add a `@Component` implementing `SceneStrategy`. Order matters (first match wins) — use `@Order(n)` to control it.

## Package layout

```
com.deskos.hub
├── HubApplication        — Spring Boot entry point
├── events/               — ingestion REST + persistence
│   ├── EventController
│   ├── VisionEvent        (entity)
│   ├── VisionEventDto     (API contract)
│   └── VisionEventRepository
├── scenes/               — strategy pattern for arrival/left behaviors
│   ├── SceneStrategy      (interface)
│   ├── SceneService       (dispatcher)
│   ├── MorningArrivalScene
│   ├── EveningArrivalScene
│   └── LeftScene
└── actuators/            — pluggable physical-world outputs
    ├── Actuator           (interface)
    └── MockActuator       (logs only)
```
