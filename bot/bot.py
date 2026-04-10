import os
import discord
from discord.ext import commands
from discord import ui
from dotenv import load_dotenv
import time

load_dotenv()

TOKEN = os.getenv('DISCORD_BOT_TOKEN')

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix='!', intents=intents)
start_time = time.time()


class AffiliateButtons(ui.View):
    def __init__(self, program_name):
        super().__init__(timeout=None)
        self.program_name = program_name

    @ui.button(label='✅ affiliate.tsに追加', style=discord.ButtonStyle.success)
    async def approve(self, interaction: discord.Interaction, button: ui.Button):
        embed = discord.Embed(
            title='✅ 承認済み',
            description=f'**{self.program_name}** の追加を承認しました。\naffiliate.tsへの追加処理を開始します...',
            color=0x1a5c3a,
        )
        await interaction.response.edit_message(embed=embed, view=None)
        # TODO: 自動でa8matコード取得→affiliate.ts編集→ビルド→デプロイ
        followup = discord.Embed(
            title='📝 手動対応が必要',
            description=f'プログラム **{self.program_name}** のa8matコードを取得してaffiliate.tsに追加してください。\n`bash scripts/deploy.sh` でデプロイ。',
            color=0xc8a84b,
        )
        await interaction.followup.send(embed=followup)

    @ui.button(label='❌ スキップ', style=discord.ButtonStyle.danger)
    async def skip(self, interaction: discord.Interaction, button: ui.Button):
        embed = discord.Embed(
            title='⏭️ スキップ',
            description=f'**{self.program_name}** をスキップしました。',
            color=0x999999,
        )
        await interaction.response.edit_message(embed=embed, view=None)


@bot.event
async def on_ready():
    print(f'Logged in as {bot.user} (ID: {bot.user.id})')
    print(f'Guilds: {len(bot.guilds)}')


@bot.event
async def on_message(message):
    # BOT自身は無視
    if message.author == bot.user:
        return

    # Webhook経由のA8.net承認通知を検出
    if message.webhook_id and message.embeds:
        embed = message.embeds[0]
        title = embed.title or ''
        desc = embed.description or ''

        if 'A8.net' in title and '承認' in (title + desc):
            program_name = title
            for field in embed.fields:
                if '承認' in field.name or 'A8' in field.name:
                    program_name = field.value
                    break

            reply_embed = discord.Embed(
                title='🔔 新規A8.net提携承認',
                description=f'**{program_name}**\n\naffiliate.tsに追加しますか？',
                color=0xc8a84b,
            )
            view = AffiliateButtons(program_name)
            await message.reply(embed=reply_embed, view=view)

    await bot.process_commands(message)


@bot.command()
async def health(ctx):
    uptime = int(time.time() - start_time)
    hours = uptime // 3600
    mins = (uptime % 3600) // 60
    embed = discord.Embed(title='🏥 HojoTown Bot Status', color=0x1a5c3a)
    embed.add_field(name='Status', value='✅ Online', inline=True)
    embed.add_field(name='Uptime', value=f'{hours}h {mins}m', inline=True)
    embed.add_field(name='Guilds', value=str(len(bot.guilds)), inline=True)
    await ctx.send(embed=embed)


bot.run(TOKEN)
