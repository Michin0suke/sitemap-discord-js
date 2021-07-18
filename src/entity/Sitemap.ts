import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  OneToMany,
  UpdateDateColumn,
  CreateDateColumn
} from 'typeorm'
import { Article } from './Article'

@Entity()
export class Sitemap {
    @PrimaryGeneratedColumn()
    id?: number;

    @Unique(['UQ_sitemap'])
    @Column()
    url: string;

    @OneToMany(type => Article, article => article.sitemap)
    articles: Article[];

    @UpdateDateColumn()
    readonly updatedAt?: Date;

    @CreateDateColumn()
    readonly createdAt?: Date;
}
