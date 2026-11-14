import { Module } from '@nestjs/common';
import { MoviesModule } from 'src/movies/movies.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from 'src/domain/entities/movie';
import { RecomendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

@Module({
  providers: [RecommendationService, MoviesModule,],
  imports: [TypeOrmModule.forFeature([Movie])],
  controllers: [RecomendationController],
})
export class RecomendationModule {}
