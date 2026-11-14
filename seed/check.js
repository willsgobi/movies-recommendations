const { readFile } = require('node:fs/promises');
const path = require('node:path');

var genresArr = [];

async function getMoviesData() {
    const csvText = await readFile(path.join(__dirname, 'minimal.csv'), 'utf8');
    var genresArray = csvText.split('\n');

    for (const line of genresArray) {
        if (line.includes('movieId,title,genres')) {
            continue;
        }

        const list = line.split('\n')
        for (const item of list) {
            var splitItem = item.split(',').at(-1).split('|');

            for (const genre of splitItem) {
                var genreItem = genre.replace("\r", "");

                if(genresArr.length === 0) {
                    genresArr.push({genre: genreItem, count: 1});
                } else {
                    var existingGenre = genresArr.filter(g => g.genre === genreItem);

                    if (existingGenre.length === 0) {
                        genresArr.push({genre: genreItem, count: 1});
                    } else {
                        existingGenre[0].count++;
                    }
                }
            }
        }
    }
    console.log(genresArr.sort((a, b) => b.count - a.count));

    return { csvText, genresArr };
}

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

async function vectorize() {
    const csvText = await readFile(path.join(__dirname, 'minimal.csv'), 'utf8');
    var genresArray = csvText.split('\n');

    for (const line of genresArray) {
        var movieId = line.split(',')[0];
        var movieName = ''

        if(!line.includes(',"')) {
            movieName = line.split(',')[1];
        } else {
            movieName = line.split(',"')[1].split('",')[0];
        }

        var movieGenres = [];
        if(!line.includes(',"')) {
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
            if(!movieGenres.includes(genre)) {
                genreVector.push(0);
            } else {
                genreVector.push(1);
            }
        }

    

        console.log({movieId, movieName, movieGenres, genreVector});
    }
}

vectorize().catch(console.error);