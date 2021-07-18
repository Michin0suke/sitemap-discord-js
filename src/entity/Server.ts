import { Entity, Column, PrimaryColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm'

@Entity()
export class Channel {
    @PrimaryColumn()
    serverId: string;

    @Column({
      nullable: false
    })
    channelId: string;

    @Column({
      nullable: false
    })
    serverName: string;

    @Column({
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP'
    })
    lastFetchedAt: Date;

    @UpdateDateColumn()
    readonly updatedAt?: Date;

    @CreateDateColumn()
    readonly createdAt?: Date;
}
