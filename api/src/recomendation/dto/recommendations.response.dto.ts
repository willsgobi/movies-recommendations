import { ApiProperty } from "@nestjs/swagger";

export class RecommendationResponseDTO {
    @ApiProperty({ example: 2959 })
    movie_id!: number;

    @ApiProperty({ example: 'Fight Club (1999)' })
    title!: string;

    @ApiProperty({ example: 0.894427 })
    similarity!: number;

    @ApiProperty({ example: 4.2729, nullable: true })
    averageRating!: number | null;

    @ApiProperty({ example: 218 })
    ratingCount!: number;

    @ApiProperty({ example: 3.501557 })
    globalAverage!: number;

    @ApiProperty({ example: 4.129022 })
    bayesianRating!: number;
}