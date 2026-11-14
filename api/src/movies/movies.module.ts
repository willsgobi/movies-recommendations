import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Movie } from "src/domain/entities/movie";

@Module({
    imports: [TypeOrmModule.forFeature([Movie])],
})

export class  MoviesModule {}