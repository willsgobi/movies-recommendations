import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecommendationService } from './recommendation.service';
import { Movie } from 'src/domain/entities/movie';
import { RecommendationsRequestDTO } from './dto/recommendations.request.dto';

describe('RecomendationService', () => {
    let service: RecommendationService;

    const mockMovieRepository = {
        query: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecommendationService,
                {
                    provide: getRepositoryToken(Movie),
                    useValue: mockMovieRepository,
                },
            ],
        }).compile();

        service = module.get<RecommendationService>(RecommendationService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });


    it('should convert database values correctly', async () => {

        const request: RecommendationsRequestDTO = {
            genres: [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            limit: 10,
        };

        mockMovieRepository.query.mockResolvedValue([
            {
                movie_id: 2959,
                title: 'Fight Club (1999)',
                similarity: 0.8944271909999159,
                average_rating: '4.2729357798165138',
                rating_count: '218',
                global_average: '3.5015569836169622',
                bayesian_rating: '4.12902182530167208',
            },
        ]);


        const result = await service.recomendations(request);

        expect(result).toHaveLength(1);
        expect(result[0].movie_id).toBe(2959);
        expect(result[0].averageRating).toBeCloseTo(4.2729, 4);
        expect(result[0].ratingCount).toBe(218);
        expect(result[0].bayesianRating).toBeCloseTo(4.1290, 4);
    });

    it('should pass genres and limit to the database', async () => {
        const request: RecommendationsRequestDTO = {
            genres: [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            limit: 10,
        };

        mockMovieRepository.query.mockResolvedValue([]);

        await service.recomendations(request);

        const [sql, params] =
            mockMovieRepository.query.mock.calls[0];

        expect(sql).toContain('LIMIT $2');
        expect(params).toEqual([
            '[1,0,1,0,0,1,0,1,0,0,0,0,0,0,0,0,1,0,0]',
            10,
        ]);
    });

    it('should handle movies without ratings', async () => {
        const request: RecommendationsRequestDTO = {
            genres: [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            limit: 10,
        };

        mockMovieRepository.query.mockResolvedValue([
            {
                movie_id: 999,
                title: 'Movie Without Ratings',
                similarity: 0.894427,
                average_rating: null,
                rating_count: '0',
                global_average: '3.5015569836169622',
                bayesian_rating: '3.5015569836169622',
            },
        ]);

        const result = await service.recomendations(request);

        expect(result).toHaveLength(1);
        expect(result[0].averageRating).toBeNull();
        expect(result[0].ratingCount).toBe(0);
        expect(result[0].bayesianRating).toBeCloseTo(3.501557, 5);
    });
});
