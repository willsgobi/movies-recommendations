# Movies Recommendations API

A content-based movie recommendation API built with **NestJS**, **TypeORM**, **PostgreSQL**, and **pgvector**, using the **MovieLens latest-small** dataset.

The API represents movies as 19-dimensional, multi-hot genre vectors and uses **cosine similarity** to retrieve relevant titles. A **Bayesian weighted rating** breaks ties in similarity, favoring ratings backed by more observations. This is a deterministic content-based recommender, **not a trained machine-learning model**.

## Features

- Preference vectors with 19 genre weights between `0` and `1`.
- Cosine similarity search using PostgreSQL's pgvector extension.
- Bayesian weighted average (`m = 50`) to break similarity ties.
- Input validation with `class-validator`.
- Interactive Swagger documentation.
- Jest unit tests for the NestJS API.

## Technology stack

Node.js · TypeScript · NestJS · TypeORM · PostgreSQL 16 · pgvector · Docker Compose · pgAdmin 4 · Jest · Swagger/OpenAPI

## Project layout

```text
movies-recommendations/
├── docker-compose.yaml       # PostgreSQL and pgAdmin containers
├── api/                      # NestJS application (locate its package.json)
└── README.md
```

> **Repository note:** The root `package.json` is not the NestJS application manifest. Run npm commands from the folder that contains the API's `package.json` and its `test`, `start:dev`, and `build` scripts. In the original local workspace this was `api/movies-recommendation`; verify that path exists in your checkout.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Docker Compose enabled.
- [Node.js](https://nodejs.org/) and npm (use a current supported LTS version).
- Git.
- MovieLens **latest-small** dataset from [GroupLens](https://grouplens.org/datasets/movielens/latest/) (`movies.csv` and `ratings.csv`).

## 1. Clone the repository

```bash
git clone https://github.com/willsgobi/movies-recommendations.git
cd movies-recommendations
```

## 2. Start PostgreSQL and pgAdmin with Docker

The committed `docker-compose.yaml` defines:

| Service | Container | Host port | Default credentials |
| --- | --- | --- | --- |
| PostgreSQL 16 | `postgres_local` | `5432` | user `postgres`, password `postgres`, database `movies_db` |
| pgAdmin 4 | `pgadmin_local` | `5050` | email `admin@admin.com`, password `admin` |

From the repository root:

```bash
docker compose up -d
docker compose ps
```

Open pgAdmin at **http://localhost:5050** and sign in using the credentials above. Register a PostgreSQL server in pgAdmin with:

- **Host name/address:** `postgres` (the Docker Compose service name, **not** `localhost` from inside the pgAdmin container)
- **Port:** `5432`
- **Maintenance database:** `movies_db`
- **Username:** `postgres`
- **Password:** `postgres`

### Important: pgvector is not included in the committed PostgreSQL image

The current Compose file specifies `image: postgres:16`, which **does not install pgvector by default**. The project needs the `vector` extension for the `vector(19)` column and `<=>` cosine-distance operator.

For a **fresh local environment**, change the PostgreSQL service image in `docker-compose.yaml` to a PostgreSQL 16 image with pgvector preinstalled:

```yaml
image: pgvector/pgvector:pg16
```

Then start the containers using `docker compose up -d`. If you have **already initialized** `./data` with the plain PostgreSQL image, changing the image may require recreating the container; **do not delete the data directory or run `docker compose down -v` without a backup**. Preserve the database and verify image compatibility before making changes.

In pgAdmin's Query Tool, connect to `movies_db` and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

If the first statement says the extension is unavailable, install/use a pgvector-enabled PostgreSQL image before proceeding.

> **Security:** The credentials above are the example development credentials currently visible in the Compose file. Do not expose these containers to the public internet or reuse those passwords in production.

## 3. Download the dataset

Download and extract **ml-latest-small.zip** from [MovieLens](https://grouplens.org/datasets/movielens/latest/). You'll need:

```text
ml-latest-small/
├── movies.csv    # movieId,title,genres
└── ratings.csv   # userId,movieId,rating,timestamp
```

The dataset used to develop this project contains approximately **9,742 movies** and **100,836 ratings**. MovieLens may publish updated versions; counts can differ.

## 4. Create the database tables

Run the following SQL in pgAdmin's Query Tool on `movies_db`. The `movies` and `ratings` tables match the data used by the recommender. The staging tables simplify CSV import and vector generation.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movies (
    movie_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    genres TEXT[] NOT NULL,
    embedding vector(19) NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id),
    rating NUMERIC NOT NULL,
    "timestamp" BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ratings_movie_id ON ratings(movie_id);

CREATE TABLE IF NOT EXISTS movies_import (
    "movieId" INTEGER,
    title TEXT,
    genres TEXT
);

CREATE TABLE IF NOT EXISTS ratings_import (
    "userId" INTEGER,
    "movieId" INTEGER,
    rating NUMERIC,
    "timestamp" BIGINT
);
```

**Note:** These are reproducibility instructions for a *fresh* database. They are not database migrations from the repository; review existing tables before running them against a database containing data.

## 5. Import the CSV files using pgAdmin

1. In pgAdmin, expand `movies_db` → **Schemas** → **public** → **Tables**.
2. Right-click **`movies_import`** → **Import/Export Data**.
3. Select **Import**, choose `movies.csv`, select CSV format, and enable **Header**. Confirm the column mapping/order is `movieId`, `title`, `genres`.
4. Repeat for **`ratings_import`** with `ratings.csv`, mapping `userId`, `movieId`, `rating`, `timestamp`.
5. Check the staging row counts:

```sql
SELECT COUNT(*) AS imported_movies FROM movies_import;
SELECT COUNT(*) AS imported_ratings FROM ratings_import;
```

The CSV files are downloaded independently; they are not assumed to be committed to this repository.

## 6. Generate the 19-dimensional movie embeddings

**Genre order is part of the API contract.** Index `0` is Action, index `18` is Western. Do not reorder the dimensions without regenerating all stored vectors.

| Index | Genre | Index | Genre |
| ---: | --- | ---: | --- |
| 0 | Action | 10 | Horror |
| 1 | Adventure | 11 | IMAX |
| 2 | Animation | 12 | Musical |
| 3 | Children | 13 | Mystery |
| 4 | Comedy | 14 | Romance |
| 5 | Crime | 15 | Sci-Fi |
| 6 | Documentary | 16 | Thriller |
| 7 | Drama | 17 | War |
| 8 | Fantasy | 18 | Western |
| 9 | Film-Noir | | |

Import each movie, convert the pipe-separated genre text to an array, and build a binary vector in the fixed order:

```sql
WITH genre_dimensions AS (
    SELECT genre, ordinal_position
    FROM unnest(ARRAY[
        'Action', 'Adventure', 'Animation', 'Children', 'Comedy',
        'Crime', 'Documentary', 'Drama', 'Fantasy', 'Film-Noir',
        'Horror', 'IMAX', 'Musical', 'Mystery', 'Romance',
        'Sci-Fi', 'Thriller', 'War', 'Western'
    ]::TEXT[]) WITH ORDINALITY AS g(genre, ordinal_position)
),
movie_vectors AS (
    SELECT
        mi."movieId" AS movie_id,
        mi.title,
        string_to_array(mi.genres, '|') AS genres,
        '[' || string_agg(
            CASE WHEN gd.genre = ANY(string_to_array(mi.genres, '|'))
                 THEN '1' ELSE '0' END,
            ',' ORDER BY gd.ordinal_position
        ) || ']' AS vector_text
    FROM movies_import mi
    CROSS JOIN genre_dimensions gd
    GROUP BY mi."movieId", mi.title, mi.genres
)
INSERT INTO movies (movie_id, title, genres, embedding)
SELECT movie_id, title, genres, vector_text::vector
FROM movie_vectors
ON CONFLICT (movie_id) DO UPDATE
SET title = EXCLUDED.title,
    genres = EXCLUDED.genres,
    embedding = EXCLUDED.embedding;
```

MovieLens includes entries with `(no genres listed)`. Their binary vectors contain only zeros. These entries are retained for completeness, but excluded from cosine-similarity queries because they have no genre information.

## 7. Import ratings into the application table

```sql
INSERT INTO ratings (user_id, movie_id, rating, "timestamp")
SELECT ri."userId", ri."movieId", ri.rating, ri."timestamp"
FROM ratings_import ri
JOIN movies m ON m.movie_id = ri."movieId"
WHERE NOT EXISTS (
    SELECT 1 FROM ratings r
    WHERE r.user_id = ri."userId"
      AND r.movie_id = ri."movieId"
);
```

For repeatable imports, consider a unique constraint on `(user_id, movie_id)` and an `ON CONFLICT` strategy. The query above prevents duplicates from a single existing import; do not treat it as a high-concurrency ingestion solution.

Verify the results:

```sql
SELECT COUNT(*) AS total_movies FROM movies;
SELECT COUNT(*) AS total_ratings FROM ratings;
SELECT COUNT(*) AS searchable_movies FROM movies WHERE vector_norm(embedding) > 0;
SELECT AVG(rating) AS global_average FROM ratings;
```

For the dataset used during development, these results were **9,742 movies**, **100,836 ratings**, **9,708 searchable movies**, and a global mean of approximately **3.501557**.

## 8. Configure the NestJS API

Locate the API's actual `package.json` (the original development path was `api/movies-recommendation`) and change to that directory:

```bash
cd api/movies-recommendation
npm install
```

The API must connect to the **host** PostgreSQL port `5432` when running directly on your computer. Typical local connection parameters are:

| Setting | Local value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `movies_db` |
| Username | `postgres` |
| Password | `postgres` |

**Check the actual TypeORM configuration in your checkout** for the supported environment variable names or connection method. If it uses environment variables, create the appropriate local `.env` file (do not commit it). Do not assume names such as `DB_HOST` are supported without checking the application's configuration.

Start the development server:

```bash
npm run start:dev
```

By default, a NestJS application listens at **http://localhost:3000** unless a different port is configured.

## 9. Try the recommendation endpoint

**Endpoint:** `POST /recommendations`

The following example sends five active genres (Action, Animation, Crime, Drama, Thriller) and requests 10 results:

```bash
curl -X POST http://localhost:3000/recommendations \
  -H "Content-Type: application/json" \
  -d '{"genres":[1,0,1,0,0,1,0,1,0,0,0,0,0,0,0,0,1,0,0],"limit":10}'
```

**Windows PowerShell:** use `curl.exe` (not the `curl` alias), or use `Invoke-RestMethod`:

```powershell
$body = @{
    genres = @(1,0,1,0,0,1,0,1,0,0,0,0,0,0,0,0,1,0,0)
    limit = 10
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3000/recommendations' `
    -Method Post -ContentType 'application/json' -Body $body
```

**Example response (abbreviated):**

```json
[
  {
    "movie_id": 2959,
    "title": "Fight Club (1999)",
    "similarity": 0.8944271909999159,
    "averageRating": 4.272935779816514,
    "ratingCount": 218,
    "globalAverage": 3.5015569836169622,
    "bayesianRating": 4.129021825301672
  }
]
```

The exact JSON property names depend on the current response DTO and mapping in the checked-out source. The example above reflects the `camelCase` mapping used during development.

### Input validation

- `genres` must contain **exactly 19** numeric weights between `0` and `1`.
- At least one weight must be greater than zero.
- `limit` must be an integer between `1` and `50`.

Try sending 19 zeros to check that the endpoint rejects the request with **HTTP 400 Bad Request**. Validation requires the NestJS `ValidationPipe` to be enabled.

## 10. How results are ranked

Each movie stores a 19-dimensional vector. For a preference vector `p` and a movie vector `v`:

```text
similarity = 1 - cosine_distance(p, v)
```

The Bayesian weighted rating is:

```text
WR = (vote_count * average_rating + m * global_average) / (vote_count + m)
m = 50
```

The SQL uses the following ranking priority:

1. **Cosine similarity descending** — most genre-relevant first.
2. **Bayesian weighted rating descending** — used **only to break similarity ties**.
3. **Movie ID ascending** — deterministic final tie-break.

A movie without ratings has `averageRating: null`, `ratingCount: 0`, and a Bayesian rating equal to the global average. A Bayesian rating is **not** a probability that someone will like the movie.

> **Candidate-selection caveat:** The project experimented with a `LIMIT 100` candidate pool and `FETCH FIRST 100 ROWS WITH TIES`. Check the currently committed query before claiming that every movie tied at the cutoff is included. If `WITH TIES` is used, ordering by a unique `movie_id` alongside similarity defeats the intended similarity-only tie expansion. For that behavior, use `ORDER BY similarity DESC FETCH FIRST 100 ROWS WITH TIES` in the candidates CTE.

## 11. Swagger / OpenAPI documentation

With the API running, open:

**http://localhost:3000/api/docs**

The Swagger UI documents the request body, response model, genre positions, and validation rules when the relevant decorators are present. Use **Try it out** → **Execute** to test `POST /recommendations` without a separate API client.

## 12. Run tests

From the NestJS application directory:

```bash
npm run test
```

Run serially for easier debugging:

```bash
npm run test -- --runInBand
```

Additional scripts included in the NestJS project:

```bash
npm run test:watch   # Watch mode
npm run test:cov     # Coverage report
npm run build        # Production build
```

During development, the Jest suite had **three passing suites and six passing tests**, including service instantiation, query parameter forwarding, numeric response conversion, and handling movies with no ratings.

**Testing scope:** The repository mock in the unit tests does **not** execute PostgreSQL SQL or validate cosine ranking/Bayesian aggregation in the database. Those require integration tests against a populated test database.

## 13. Stop or restart the containers

From the repository root:

```bash
docker compose stop        # Stop without deleting containers
docker compose start       # Start existing containers
docker compose down        # Remove containers and network; preserve bind-mounted data
docker compose up -d       # Create/start again
```

**Never delete `./data` unless you intend to lose the database.** The Compose file mounts PostgreSQL data from the repository's `./data` directory.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `extension "vector" is not available` | The default `postgres:16` image lacks pgvector; use a pgvector-enabled image. |
| Database connection refused | Docker Desktop is running, containers are healthy, port `5432` is free, and TypeORM points to the right host. |
| pgAdmin cannot connect | From the pgAdmin container, use host `postgres`, not `localhost`. |
| API returns no movies | Confirm both CSV imports and generated `embedding` values. |
| `npm error Missing script: test` | Run npm from the **NestJS package directory**, not the repository root. |
| Jest cannot resolve `src/...` | Configure Jest `moduleNameMapper` for `^src/(.*)$` → `<rootDir>/$1` when `rootDir` is `src`. |
| Jest cannot inject `MovieRepository` | Register a mock provider using `getRepositoryToken(Movie)` in the testing module. |
| Empty or zero genre vector rejected | Supply at least one positive genre weight. |

## Dataset and credits

Data: [MovieLens — GroupLens Research](https://grouplens.org/datasets/movielens/latest/). Please follow the dataset's terms and attribution requirements.

Project: [willsgobi/movies-recommendations](https://github.com/willsgobi/movies-recommendations).
