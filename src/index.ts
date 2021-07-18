import { Client, DMChannel, NewsChannel, TextChannel } from 'discord.js'
import { DISCORD_TOKEN } from '../config'
import fetch from 'node-fetch'
import 'reflect-metadata'
import { createConnection, Repository } from 'typeorm'
import { Channel } from './entity/Server'
import { Article } from './entity/Article'
import { Sitemap } from './entity/Sitemap'
import { HELP } from './help'
import { subArr } from './subArr'

const client = new Client()

let channelRepository: Repository<Channel>
let articleRepository: Repository<Article>
let sitemapRepository: Repository<Sitemap>

createConnection().then(async (connection) => {
  channelRepository = connection.getRepository(Channel)
  sitemapRepository = connection.getRepository(Sitemap)
  articleRepository = connection.getRepository(Article)
})

// const sendObj = (channel: TextChannel | DMChannel | NewsChannel, obj: any) => {
//   channel.send(JSON.stringify(obj, null, 4))
// }

const fetchUrlsFromSitemap = async (sitemapUrl: string): Promise<string[]> => {
  console.log(`fetching...(${sitemapUrl})`)
  const xml = await fetch(sitemapUrl).then(response => response.text())
  return xml.match(/(?<=<loc>.*)https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#\u3000-\u30FE\u4E00-\u9FA0\uFF01-\uFFE3]+(?=.*<\/loc>)/g) ?? []
  // return xml.match(/(?<=<loc>)(.+)(?=<\/loc>)/gi) ?? []
}

const isValidSitemap = async (sitemapUrl: string): Promise<boolean> => {
  const urls = await fetchUrlsFromSitemap(sitemapUrl)
  return urls.length > 0
}

const removeSitemap = async (sitemap: Sitemap): Promise<Sitemap | undefined> => {
  // 関連づけられた記事を削除
  const articles = await articleRepository.find({ sitemap })
  await articleRepository.remove(articles)

  // サイトマップの削除
  const removedSitemap = await sitemapRepository.remove(sitemap)
  return removedSitemap
}

const isRegisteredChannel = async (channel: TextChannel | DMChannel | NewsChannel): Promise<boolean> => {
  if (!(await channelRepository.findOne())) {
    channel.send('最初に`init`コマンドを実行してください。')
    return false
  }
  return true
}

const updateArticle = async () => {
  if (!channelRepository || !articleRepository || !sitemapRepository) {
    return
  }

  const channelId = (await channelRepository.findOne())?.channelId
  if (channelId) {
    const channel = client.channels.cache.get(channelId)
    const sitemaps = await sitemapRepository.find()

    sitemaps.forEach(async sitemap => {
      const sitemapEntity = await sitemapRepository.findOne({ url: sitemap.url })
      const dbArticles = await articleRepository.find({ sitemap: sitemapEntity })
      const dbArticleUrls = dbArticles.map(article => article.articleUrl)
      const fetchedArticleUrls = await fetchUrlsFromSitemap(sitemap.url)
      const addedUrls = subArr(fetchedArticleUrls, dbArticleUrls)

      for (let i = 0; i < 3; i++) {
        if (addedUrls.slice(-3)[i]) {
          (client.channels.cache.get(channelId) as TextChannel).send(addedUrls.slice(-3)[i])
        }
      }

      addedUrls.forEach(addedUrl => {
        const article = new Article()
        article.sitemap = sitemapEntity
        article.articleUrl = addedUrl
        const savedArticle = articleRepository.save(article)
        if (!savedArticle) {
          (channel as TextChannel)
            .send(`urlの保存に失敗しました。(${addedUrl})`)
        }
      })
    })

    const channelEntity = await channelRepository.findOne()
    channelEntity.lastFetchedAt = new Date()
    channelRepository.save(channelEntity)
  }
}

client.on('ready', () => {
  console.log('I am ready!')

  setTimeout(() => {
    updateArticle()
  }, 10000)

  setInterval(async () => {
    updateArticle()
  }, 15 * 1000 * 60)
})

client.on('message', async message => {
  const targetUserId = message.mentions.members.first()?.id
  if (targetUserId === client.user.id) {
    // list
    if (message.content.match('list') || message.content.match('ls')) {
      if (!await isRegisteredChannel(message.channel)) return

      const sitemaps = await sitemapRepository.find()
      if (sitemaps.length === 0) {
        message.channel.send('サイトマップは登録されていません。')
      } else {
        message.channel.send(
          '[監視中のサイトマップ一覧]\n' +
          '[ID]\n' +
          sitemaps.map(sitemap => `[${sitemap.id}] ${sitemap.url}`).join('\n')
        )
      }
      return
    }

    // save
    if (message.content.match('save')) {
      if (!await isRegisteredChannel(message.channel)) return

      const sitemapUrl = message.content.match(/(http[^ ]+)/)?.[0]
      if (!sitemapUrl) {
        message.channel.send('URLを指定してください。')
        return
      }
      if (!(await isValidSitemap(sitemapUrl))) {
        message.channel.send('有効なサイトマップURLを指定してください。')
        return
      }
      const sitemap = new Sitemap()
      sitemap.url = sitemapUrl
      await sitemapRepository.save(sitemap)
      message.channel.send('URLを登録しました。')
      updateArticle()
      return
    }

    // rm
    if (message.content.match('rm') || message.content.match('remove')) {
      if (!await isRegisteredChannel(message.channel)) return

      const sitemapId = message.content.match(/\d+$/)?.[0]
      if (!sitemapId) {
        message.channel.send('IDを指定してください。')
        return
      }
      const targetSitemap = await sitemapRepository.findOne(sitemapId)
      if (!targetSitemap) {
        message.channel.send(`IDが${sitemapId}のサイトマップは登録されていません。`)
        return
      }

      const removedSitemap = await removeSitemap(targetSitemap)
      message.channel.send(`サイトマップ（\`${removedSitemap.url}\`）を削除しました。`)
      return
    }

    // help
    if (message.content.match('help')) {
      message.channel.send(HELP)
      return
    }

    // free
    if (message.content.match('free')) {
      if (!await isRegisteredChannel(message.channel)) return

      const sitemaps = await sitemapRepository.find()
      sitemaps.forEach(sitemap => removeSitemap(sitemap))
      const channels = await channelRepository.find()
      channels.forEach(channel => channelRepository.remove(channel))

      message.channel.send('連携を解除しました。\n再度連携させるには、`init`コマンドを使用してください。')
      return
    }

    // init
    if (message.content.match('init')) {
      // すでに存在しているレコードはクリア
      const existRecord = await channelRepository.find()
      await channelRepository.remove(existRecord)

      const channel = new Channel()
      channel.serverId = message.guild.id
      channel.channelId = message.channel.id
      channel.serverName = message.guild.nameAcronym
      const savedChannelEntity = await channelRepository.save(channel)

      if (savedChannelEntity) {
        message.channel.send(
          '以下の内容で登録しました。\n' +
          `サーバ名: ${savedChannelEntity.serverName}\n` +
          `サーバID: ${savedChannelEntity.serverId}\n` +
          `チャンネルID: ${savedChannelEntity.channelId}`
        )
      } else {
        message.channel.send('データの登録に失敗しました。')
      }
      return
    }

    // status
    if (message.content.match('status')) {
      const channel = await channelRepository.findOne()
      if (!channel) {
        message.channel.send(
          'チャンネルが連携されていません。\n' +
          '任意のチャンネルで、`init`を使用してください。'
        )
        return
      }
      message.channel.send(
        '以下の内容で登録されています。\n' +
          `サーバ名: ${channel.serverName}\n` +
          `サーバID: ${channel.serverId}\n` +
          `チャンネルID: ${channel.channelId}\n` +
          `最終取得日時: ${channel.lastFetchedAt}`
      )
      return
    }

    // hello
    if (message.content.match('hello')) {
      message.channel.send(
        `${message.author.username}さん、こんにちは！\n` +
        `${client.user.username}です。よろしくお願いします！`
      )
      return
    }

    // fetch
    if (message.content.match('fetch')) {
      message.channel.send('サイトマップを取得中...')
      const sitemapUrl = message.content.match(/(http[^ ]+)/)?.[0]
      if (!sitemapUrl) {
        message.channel.send('URLを指定してください。')
        return
      }
      if (!(await isValidSitemap(sitemapUrl))) {
        message.channel.send('有効なサイトマップURLを指定してください。')
        return
      }
      const urls = await fetchUrlsFromSitemap(sitemapUrl)
      message.channel.send('`' + urls.join('\n').slice(0, 1900) + '`')
      return
    }

    message.channel.send('コマンドを検出できませんでした。\n利用できるコマンド一覧は、`help`で確認できます。')
  }
})

client.login(DISCORD_TOKEN)
