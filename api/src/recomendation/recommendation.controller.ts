import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationsRequestDTO } from './dto/recommendations.request.dto';
import { RecommendationResponseDTO } from './dto/recommendations.response.dto';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { MOVIE_GENRES } from './constants';

@Controller('recommendations')
export class RecomendationController {
    constructor(private readonly recommendationService: RecommendationService) { }
    @ApiOperation({
        summary: 'Recomendar filmes',
        description: `Recomenda filmes por similaridade de cosseno, utilizando a média bayesiana como desempate. 
Vetor de preferências com 19 posições. Cada peso varia de 0 a 1.

**Ordem dos gêneros:**

${MOVIE_GENRES.map((genre, index) => `- **${index}**: ${genre}`).join('\n')}
    `,
    })
    @ApiCreatedResponse({
        description: 'Filmes recomendados com sucesso.',
        type: RecommendationResponseDTO,
        isArray: true,
    })
    @ApiBadRequestResponse({
        description: 'Preferências ou limite inválidos.',
    })
    @Post()
    async post(@Body() request: RecommendationsRequestDTO): Promise<RecommendationResponseDTO[]> {
        console.log('Controller:', request);

        if (request.genres.length !== 19) {
        }

        return await this.recommendationService.recomendations(request);
    }
}
