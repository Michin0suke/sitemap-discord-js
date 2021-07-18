import { Entity, PrimaryGeneratedColumn, Column, Unique, ManyToOne, UpdateDateColumn, CreateDateColumn } from 'typeorm'
import { Sitemap } from './Sitemap'

@Entity()
export class Article {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(type => Sitemap, sitemap => sitemap.articles, {
      nullable: false
    })
    sitemap: Sitemap;

    @Column({
      nullable: false
    })
    @Unique(['UQ_articleUrl'])
    articleUrl: string;

    @UpdateDateColumn()
    readonly updatedAt?: Date;

    @CreateDateColumn()
    readonly createdAt?: Date;
}
