import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, Max, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'atLeastOneGenre', async: false })
class AtLeastOneGenre implements ValidatorConstraintInterface {
    validate(genres: number[]) {
        return Array.isArray(genres) &&
            genres.some(value => typeof value === 'number' && value > 0);
    }

    defaultMessage() {
        return 'At least one genre must have a weight greater than zero';
    }
}

export class RecommendationsRequestDTO {
    @ApiProperty({
        description: 'Vetor de preferências com 19 pesos entre 0 e 1.',
        type: Number,
        isArray: true,
        minItems: 19,
        maxItems: 19,
        minimum: 0,
        maximum: 1,
        example: [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    })
    @IsArray()
    @ArrayMinSize(19)
    @ArrayMaxSize(19)
    @IsNumber({}, { each: true })
    @Min(0, { each: true })
    @Max(1, { each: true })
    @Validate(AtLeastOneGenre)
    genres!: number[]

    @ApiProperty({
        description: 'Quantidade máxima de recomendações.',
        minimum: 1,
        maximum: 50,
        example: 10,
    })
    @IsNumber()
    limit!: number
}