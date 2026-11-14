import {Entity, PrimaryGeneratedColumn, Column } from 'typeorm'
@Entity('movies')
export class Movie {
    @PrimaryGeneratedColumn({type: 'integer', name: 'movie_id'})
    movieId!: Number

    @Column({type: 'text'})
    title!: string

    @Column({type: 'text', array: true})
    genres!: string[]

    @Column({type: 'vector'})
    embedding!: number[]
}