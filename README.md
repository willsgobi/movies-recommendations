# Movies Recommendations API

A content-based movie recommendation API built with **NestJS**, **TypeScript**, **PostgreSQL**, and **pgvector**. It recommends movies from the MovieLens dataset based on a user's preferred genres and uses a **Bayesian weighted rating** to break ties between equally similar movies.

> **Project status:** educational MVP. Recommendations are computed using genre vectors and aggregate ratings; no machine-learning model has been trained yet.

## Features

- 19-dimensional genre embeddings (multi-hot vectors)
- Cosine similarity search with pgvector
- Bayesian weighted ratings as a tie-breaker, not a combined score
- Input validation (19 genre weights between 0 and 1, at least one positive weight)
- Swagger/OpenAPI documentation
- Jest unit tests
- MovieLens Small dataset: **9,742 movies** and **100,836 ratings**

## Tech stack

- Node.js and TypeScript
- NestJS and TypeORM
- PostgreSQL 16 + pgvector
- Docker Compose and pgAdmin
- Jest

## Project layout

The following layout describes where the files need to be for the commands below. If you keep the seed files in a different directory, run the seed from that directory instead.

```text
movies-recommendations/
├── docker-compose.yaml
├── db.js                    # Movie and rating seed script
├── movies.csv               # Supplied MovieLens movie data
├── ratings.csv              # Supplied MovieLens rating data
└── api/
    └── movies-recommendation/
        ├── package.json
        └── src/
```

## 1. Prerequisites

Install:

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Docker Compose)
- [Node.js](https://nodejs.org/) **22 or later** and npm

Make sure ports **5432** (PostgreSQL), **5050** (pgAdmin), and **3000** (default API port) are available, or adjust your configuration accordingly.

## 2. Clone the repository

```bash
git clone https://github.com/willsgobi/movies-recommendations.git
cd movies-recommendations
```

## 3. Start PostgreSQL and pgAdmin with Docker

The repository's original `docker-compose.yaml` uses `postgres:16`. **That base image does not bundle pgvector.** For a fresh installation, change the PostgreSQL image to one that includes the extension:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    # Keep the remaining service settings from docker-compose.yaml
```

The existing Compose configuration exposes:

| Service | Host address / port | Credentials |
| --- | --- | --- |
| PostgreSQL | `localhost:5432` | `postgres` / `postgres` |
| Database | `movies_db` | Created by `POSTGRES_DB` on first initialization |
| pgAdmin | <http://localhost:5050> | `admin@admin.com` / `admin` |

Start the containers from the repository root:

```bash
docker compose up -d
```

Check their status:

```bash
docker compose ps
```

> **Existing installations:** Switching images on an initialized database is not a data migration. Back up your database first and verify volume compatibility. Never delete the `data` directory or run destructive volume-reset commands against data you want to keep.
>
> These default credentials are intended for local development only.

### Optional: connect with pgAdmin

Open <http://localhost:5050>, log in, and register a server using **Host** `postgres` (the Compose service name), **Port** `5432`, **Username** `postgres`, **Password** `postgres`, and **Maintenance database** `movies_db`. From a process running on your host machine, use `localhost` instead of `postgres`.

## 4. Enable pgvector and prepare the database schema

**Important:** `db.js` imports the data and builds the 19-dimensional embeddings, but it **does not** install/enable pgvector or create the `movies` and `ratings` tables. These are one-time database prerequisites for a clean setup. You do **not** need to manually insert movie or rating rows.

Run the following schema initialization once, either through pgAdmin Query Tool connected to `movies_db`, or from a terminal:

```bash
docker exec -i postgres_local psql -U postgres -d movies_db
```

Paste the SQL below into `psql` (or run it in pgAdmin):

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movies (
    movie_id  INTEGER PRIMARY KEY,
    title     TEXT NOT NULL,
    genres    TEXT[] NOT NULL,
    embedding VECTOR(19) NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   INTEGER NOT NULL,
    movie_id  INTEGER NOT NULL,
    rating    NUMERIC NOT NULL,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ratings_movie_id ON ratings(movie_id);
```

Enter `\q` to exit `psql`.

Verify the extension:

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';
```

The development database was verified with **pgvector 0.8.7**. A new Docker image may bundle another compatible version.

> If `CREATE EXTENSION` fails because the `vector` control file is missing, pgvector is not installed in that PostgreSQL container. Check that the Compose image is `pgvector/pgvector:pg16` and that you are connected to the intended container.

## 5. Seed movies, ratings, and embeddings

The included `db.js` performs both data imports:

1. Reads **`movies.csv`** from the current working directory.
2. Converts each movie's genres into a **19-element binary embedding**.
3. Inserts movie ID, title, genre array, and embedding into `movies`.
4. Reads **`ratings.csv`** from the current working directory.
5. Inserts user ID, movie ID, rating, and timestamp into `ratings`.

The supplied CSV files are **already formatted for this script** (they have no header row). No separate CSV download, manual data import, or SQL `INSERT` statements are required.

The script imports `pg-promise` and uses ES module syntax. From the directory containing **all three files** (`db.js`, `movies.csv`, `ratings.csv`), install its dependency if necessary:

```bash
npm install pg-promise
```

If the directory's `package.json` does not already declare ES module support, set it once:

```bash
npm pkg set type=module
```

Run the seed:

```bash
node db.js
```

**Seed database connection (currently hard-coded in `db.js`):**

```text
postgres://postgres:postgres@localhost:5432/movies_db
```

If your host, port, credentials, or database name differ, edit that connection string before running the script. The CSV paths are relative to the **directory you run `node` from**, not necessarily to the script location.

**Important limitations of the current seed script:**

- It performs ordinary `INSERT` statements and is **not idempotent**. Run it once against empty tables; running it again will conflict with existing `movies.movie_id` values.
- It inserts rows sequentially, so importing approximately 110,000 records may take time and produce extensive console output.
- It does not create the schema, create the extension, or automatically recover from a partially completed import.

### Verify the imported data

In pgAdmin, or using `psql`, run:

```sql
SELECT COUNT(*) AS movies_count FROM movies;
SELECT COUNT(*) AS ratings_count FROM ratings;
SELECT movie_id, title, genres, embedding FROM movies LIMIT 5;
```

Expected counts for the supplied CSVs:

| Table | Expected rows |
| --- | ---: |
| `movies` | 9,742 |
| `ratings` | 100,836 |

The original MovieLens data contains **34 movies without a listed genre**. Their embeddings contain only zeros and are excluded from cosine similarity searches.

## 6. Configure the NestJS API

Go to the API directory:

```bash
cd api/movies-recommendation
npm install
```

Ensure the TypeORM database configuration matches the local database:

```text
host: localhost
port: 5432
username: postgres
password: postgres
database: movies_db
```

Use the configuration mechanism already implemented in the API (for example, environment variables or the TypeORM module options). The seed's hard-coded connection string does **not** configure the API automatically.

## 7. Start the API

From `api/movies-recommendation`:

```bash
npm run start:dev
```

The API normally runs at <http://localhost:3000>. If your application uses a different port or global prefix, use that value in the following examples.

## 8. Explore the API with Swagger

Open:

<http://localhost:3000/api/docs>

Find **POST `/recommendations`**. The documentation includes the 19 genre positions and the request/response models.

### Genre vector order

**Do not change this order** without regenerating the movie embeddings.

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

Each weight is between `0` and `1`; at least one weight must be greater than zero.

## 9. Test recommendations

Request:

```http
POST /recommendations
Content-Type: application/json
```

Body:

```json
{
  "genres": [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  "limit": 10
}
```

Try it directly in Swagger, or use curl:

```bash
curl -X POST http://localhost:3000/recommendations \
  -H "Content-Type: application/json" \
  -d '{"genres":[1,0,1,0,0,1,0,1,0,0,0,0,0,0,0,0,1,0,0],"limit":10}'
```

An abbreviated example response (values shown for illustration):

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

The API returns an array of movies, ordered first by **cosine similarity**, then by **Bayesian weighted rating** when similarity values are equal. Your output may differ if the database or implementation changes.

### Test request validation

Try a vector of 19 zeros or an array with fewer than 19 entries. The configured validation should return **HTTP 400** instead of running a cosine similarity search with an invalid vector.

## 10. How recommendation ranking works

**Candidate retrieval:** Convert genre preferences into a vector, exclude zero-magnitude movie embeddings, and retrieve the most similar movies using pgvector cosine distance (`<=>`).

**Tie-breaking:** For movies with equal cosine similarity, rank by the Bayesian weighted rating:

```text
weighted_rating = (v * R + m * C) / (v + m)
```

Where:

- `R`: the movie's average rating
- `v`: number of ratings for the movie
- `C`: global average across all ratings
- `m`: smoothing constant (`50` in this project)

A movie with no ratings receives the global average as its Bayesian score. A movie with very few ratings is pulled toward the global average, so a single high rating does not dominate ties.

The implementation retrieves candidates first and then applies the rating tie-breaker. **Candidate selection can affect which tied movies are eligible**; inspect the API's actual SQL when comparing candidate limits or `FETCH FIRST ... WITH TIES` behavior.

## 11. Run automated tests

From the API directory:

```bash
npm run test
```

To run Jest serially:

```bash
npm run test -- --runInBand
```

Other available scripts include:

```bash
npm run test:watch
npm run test:cov
```

The project currently includes service, controller, and application test suites. Unit tests mock the repository; they do **not** execute the pgvector query against PostgreSQL. Integration testing is a future improvement.

## 12. Stop the containers

From the repository root:

```bash
docker compose down
```

This stops/removes the containers while preserving the local bind-mounted database files. Avoid deleting the `data` and `pgadmin` directories unless you intentionally want to remove their persisted state.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `extension "vector" is not available` | The running PostgreSQL image must contain pgvector; use `pgvector/pgvector:pg16` for a fresh installation. |
| `relation "movies" does not exist` | The schema initialization in Step 4 has not been run in `movies_db`. |
| `duplicate key value violates unique constraint` | The seed has already inserted some movies. It is not safe to rerun against populated tables without first reconciling the data. |
| `Cannot find package 'pg-promise'` | Run `npm install pg-promise` in the directory that contains `db.js`. |
| `ENOENT: ... movies.csv` | Run `node db.js` from the directory containing the CSV files. |
| `ECONNREFUSED` or authentication failure | Verify Docker services, the database connection string, and credentials. |
| Swagger URL does not load | Verify the configured API port and `SwaggerModule.setup(...)` path. |
| Jest cannot resolve `src/...` | Check `moduleNameMapper` in the API's Jest configuration. |

## Data attribution

Movie metadata and ratings come from the [MovieLens datasets](https://grouplens.org/datasets/movielens/) maintained by GroupLens. Refer to the original dataset's terms and citation guidance before redistributing it.

## Repository

<https://github.com/willsgobi/movies-recommendations>
