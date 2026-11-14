import pgPromise from 'pg-promise';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const pgp = pgPromise({});
const db = pgp('postgres://postgres:postgres@localhost:5432/movies_db');

var genres =
    [
        'Action',
        'Adventure',
        'Animation',
        'Children',
        'Comedy',
        'Crime',
        'Documentary',
        'Drama',
        'Fantasy',
        'Film-Noir',
        'Horror',
        'IMAX',
        'Musical',
        'Mystery',
        'Romance',
        'Sci-Fi',
        'Thriller',
        'War',
        'Western'
    ]

async function seedMovies() {
    const csvText = await readFile(path.join('./', 'movies.csv'), 'utf8');
    var genresArray = csvText.split('\n');

    for (const line of genresArray) {
        var movieId = line.split(',')[0];
        var movieName = ''

        if (!line.includes(',"')) {
            movieName = line.split(',')[1];
        } else {
            movieName = line.split(',"')[1].split('",')[0];
        }

        var movieGenres = [];
        if (!line.includes(',"')) {
            var normalGenres = line.split(',').at(2).split('|');
            for (const genre of normalGenres) {
                movieGenres.push(genre.trim().replace("\r", ""));
            }
        } else {
            var splitted = line.split(',"')[1].split('",')[1].split('|');

            for (const genre of splitted) {
                movieGenres.push(genre.trim().replace("\r", ""));
            }
        }

        var genreVector = [];

        for (const genre of genres) {
            if (!movieGenres.includes(genre)) {
                genreVector.push(0);
            } else {
                genreVector.push(1);
            }
        }

        var movieIdInsert = Number(movieId);
        var titleInsert = movieName.replaceAll("'", "''");
        var genresInsert = movieGenres.join(",")
        var embeddingInsert = `[${genreVector.join(",")}]`

        console.log({ movieIdInsert, titleInsert, genresInsert, embeddingInsert });

        await db.result(`INSERT INTO movies (movie_id, title, genres, embedding) VALUES (${movieIdInsert}, '${titleInsert}', string_to_array('${genresInsert}'::text, ','::text), ('[${genreVector}]'))`);
    }
}

async function seedRatings() {
    const csvText = await readFile(path.join('./', 'ratings.csv'), 'utf8');
    var ratings = csvText.split('\n');

    var total = 0;

    for (const line of ratings) {
        const ratingArr = line.trim().replace("\r", "").split(',');
        var userId = Number(ratingArr[0]);
        var movieId = Number(ratingArr[1]);
        var rating = Number(ratingArr[2]);
        var timestamp = Number(ratingArr[3]);

        console.log({ userId, movieId, rating, timestamp });

        await db.result(`INSERT INTO ratings (user_id, movie_id, rating, timestamp) VALUES (${userId}, ${movieId}, ${rating}, ${timestamp})`);

        total = total + 1;
    }

    console.log(total);
}

async function seedAsync() {
    await seedMovies();
    await seedRatings();
}

seedAsync()