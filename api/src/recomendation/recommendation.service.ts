import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from 'src/domain/entities/movie';
import { RecommendationsRequestDTO } from './dto/recommendations.request.dto';
import { RecommendationResponseDTO } from './dto/recommendations.response.dto';

@Injectable()
export class RecommendationService {
    constructor(
        @InjectRepository(Movie)
        private readonly movieRepository: Repository<Movie>,
    ) { }

    async recomendations(recommendationDTO: RecommendationsRequestDTO): Promise<RecommendationResponseDTO[] | []> {

        const movies = await this.#findAll(recommendationDTO);

        return movies;
    }

    async #findAll(recommendation: RecommendationsRequestDTO): Promise<RecommendationResponseDTO[]> {


        const vectorString = `[${recommendation.genres.join(',')}]`;
        const sql = `
            WITH candidates AS MATERIALIZED (
                SELECT
                    m.movie_id,
                    m.title,
                    (1 - (embedding <=> $1::vector)) as similarity
                FROM movies m
                WHERE vector_norm(m.embedding) > 0
                ORDER BY similarity DESC, m.movie_id FETCH FIRST 100 ROWS WITH TIES
            ),
            movie_ratings AS (
                SELECT
                    r.movie_id,
                    AVG(r.rating) AS average_rating,
                    COUNT(*) AS rating_count
                FROM ratings r
                INNER JOIN candidates c ON c.movie_id = r.movie_id
                GROUP BY r.movie_id
            ),
            global_rating AS (
                SELECT AVG(rating) AS global_average FROM ratings
            )
            SELECT
                c.movie_id,
                c.title,
                c.similarity,
                mr.average_rating,
                COALESCE(mr.rating_count, 0) AS rating_count,
                gr.global_average,
                (
                COALESCE(mr.rating_count * mr.average_rating, 0) + 50.0 * gr.global_average
                ) / (COALESCE(mr.rating_count, 0) + 50.0) AS bayesian_rating
            FROM candidates c
            LEFT JOIN movie_ratings mr
                ON mr.movie_id = c.movie_id
            CROSS JOIN global_rating gr
            ORDER BY similarity DESC
                FETCH FIRST 100 ROWS WITH TIES
            LIMIT $2;
        `;

        const movies = await this.movieRepository.query(sql, [vectorString, recommendation.limit]);

       return movies.map(movie => {
            return {
                movie_id: Number(movie.movie_id),
                title: movie.title,
                similarity: Number(movie.similarity),
                averageRating: movie.average_rating === null
                    ? null
                    : Number(movie.average_rating),
                ratingCount: Number(movie.rating_count),
                globalAverage: Number(movie.global_average),
                bayesianRating: Number(movie.bayesian_rating),
            };
        });
    }
}
