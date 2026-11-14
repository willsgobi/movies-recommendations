import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; // Ajuste o caminho
import { RecommendationService } from './recommendation.service';
import { Movie } from 'src/domain/entities/movie';

describe('RecommendationsService', () => {
    let service: RecommendationService;
    let repository: jest.Mocked<Pick<Repository<Movie>, 'query'>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecommendationService,
                {
                    provide: getRepositoryToken(Movie),
                    useValue: {
                        query: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<RecommendationService>(RecommendationService);
        repository = module.get(getRepositoryToken(Movie));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});