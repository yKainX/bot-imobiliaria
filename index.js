const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const token = process.env.TOKEN; 
const clientId = '1421788914359734352'; 
const guildId = '1421792890094489662'; 
const channelId = '1421792929999093820';
const usersToNotify = ['583690987793285130'];

const readDatabase = () => {
  try {
    const data = fs.readFileSync('database.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler database.json:', error);
    return { sales: [], report_start_date: null };
  }
};

const saveDatabase = (data) => {
  fs.writeFileSync('database.json', JSON.stringify(data, null, 2), 'utf8');
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('ready', async () => {
    console.log(`Bot está online! Logado como ${client.user.tag}`);
    
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 1 });
        if (messages.size === 0 || messages.first().author.id !== client.user.id) {
            const embed = new EmbedBuilder()
                .setColor('#00ffff')
                .setTitle('Registro de Vendas de Imóveis')
                .setDescription('Clique no botão abaixo para registrar a venda de um imóvel de forma rápida e segura.');
                
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('vender_imovel_btn')
                        .setLabel('Registrar Venda')
                        .setStyle(ButtonStyle.Primary)
                );
            await channel.send({ embeds: [embed], components: [row] });
            console.log('Mensagem de registro de vendas enviada.');
        } else {
            console.log('Mensagem de registro de vendas já existe.');
        }
    }

    const commands = [
        new SlashCommandBuilder()
            .setName('vendas-gerais')
            .setDescription('Busca todas as vendas registradas de um agente.')
            .addStringOption(option =>
                option.setName('agente')
                    .setDescription('O nome ou ID do agente de vendas.')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('vendas-semanal')
            .setDescription('Busca as vendas semanais de um agente, incluindo comissão.')
            .addStringOption(option =>
                option.setName('agente')
                    .setDescription('O nome ou ID do agente de vendas.')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('iniciar-relatorio')
            .setDescription('Marca o início de um novo período para o relatório semanal. (Apenas Admins)'),
        new SlashCommandBuilder()
            .setName('finalizar-relatorio')
            .setDescription('Finaliza e exibe o relatório de vendas de todos os agentes. (Apenas Admins)'),
        new SlashCommandBuilder()
            .setName('venda')
            .setDescription('Abre o formulário para registrar uma venda.'),
        new SlashCommandBuilder()
            .setName('resetar-database')
            .setDescription('Apaga todos os dados de venda do banco de dados. (Apenas Admins)'),
    ];

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'vender_imovel_btn' || interaction.customId === 'editar_venda_btn') {
            await showVendaModal(interaction);
        }
        if (interaction.customId === 'confirm_reset_db_btn') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
            }

            const db = readDatabase();
            db.sales = [];
            db.report_start_date = null;
            saveDatabase(db);
            await interaction.update({ content: 'Banco de dados resetado com sucesso! Todos os dados de venda foram apagados.', embeds: [], components: [] });
        }
        if (interaction.customId === 'cancel_reset_db_btn') {
            await interaction.update({ content: 'Reset do banco de dados cancelado.', embeds: [], components: [] });
        }
    }
    
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'venda_imovel_modal') {
            const vendidoPara = interaction.fields.getTextInputValue('vendido_para_input');
            const valorInteriorStr = interaction.fields.getTextInputValue('valor_interior_input');
            const temTranca = interaction.fields.getTextInputValue('tem_tranca_input');
            const comGaragem = interaction.fields.getTextInputValue('com_garagem_input');
            const vendidoPor = interaction.fields.getTextInputValue('vendido_por_input');
            
            const valorInterior = parseInt(valorInteriorStr.replace(/[^0-9]/g, ''), 10);
            if (isNaN(valorInterior)) {
                await interaction.reply({ content: 'Erro: O valor do interior deve ser um número válido.', ephemeral: true });
                return;
            }

            const db = readDatabase();
            const newSale = {
                vendidoPara,
                valorInterior,
                temTranca,
                comGaragem,
                vendidoPor,
                timestamp: new Date().toISOString()
            };
            db.sales.push(newSale);
            saveDatabase(db);
            
            const embed = new EmbedBuilder()
                .setColor('#00ffff')
                .setTitle('🏡 Venda de Imóvel Registrada')
                .setDescription('---')
                .addFields(
                    { name: 'Vendida para:', value: `\`\`\`${vendidoPara}\`\`\``, inline: false },
                    { name: 'Valor do Interior:', value: `\`\`\`$${valorInterior.toLocaleString('pt-BR')}\`\`\``, inline: false },
                    { name: 'Tem Tranca?', value: `\`\`\`${temTranca}\`\`\``, inline: false },
                    { name: 'Com Garagem?', value: `\`\`\`${comGaragem}\`\`\``, inline: false },
                    { name: 'Vendida por:', value: `\`\`\`${vendidoPor}\`\`\``, inline: false },
                )
                .setFooter({ text: 'Se tiver anexos para adicionar (fotos/clips), responda a esta mensagem com seu arquivo.' })
                .setTimestamp();
            
            const editRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('editar_venda_btn')
                        .setLabel('Editar Venda')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                const notificationContent = usersToNotify.map(id => `<@${id}>`).join(' ');
                await channel.send({ content: notificationContent, embeds: [embed], components: [editRow] });
            }
            
            await interaction.reply({ content: 'Registro de venda enviado com sucesso!', ephemeral: true });
        }
    }

    if (interaction.isChatInputCommand()) {
        const { commandName, member } = interaction;

        if (commandName === 'vendas-gerais') {
            await interaction.deferReply();
            const agente = interaction.options.getString('agente').toLowerCase();
            const db = readDatabase();
            
            const sales = db.sales.filter(sale => sale.vendidoPor.toLowerCase().includes(agente));
            
            if (sales.length > 0) {
                const totalSalesValue = sales.reduce((sum, sale) => sum + sale.valorInterior, 0);
                const commission = totalSalesValue * 0.10;
                const salesList = sales.map(sale => `- Venda para: \`\`\`${sale.vendidoPara}\`\`\` | Valor: \`\`\`$${sale.valorInterior.toLocaleString('pt-BR')}\`\`\``).join('\n');
                
                const replyEmbed = new EmbedBuilder()
                    .setColor('#00ffff')
                    .setTitle(`📊 Relatório Geral de Vendas para ${agente.toUpperCase()}`)
                    .setDescription(`**Total de Vendas:** ${sales.length}\n**Valor Total Vendido:** \`\`\`$${totalSalesValue.toLocaleString('pt-BR')}\`\`\`\n**Comissão (10%):** \`\`\`$${commission.toLocaleString('pt-BR')}\`\`\`\n\n**Detalhes das Vendas:**\n${salesList}`);
                await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                await interaction.editReply(`Não encontrei nenhuma venda registrada para o agente "${agente}".`);
            }
        }

        if (commandName === 'vendas-semanal') {
            await interaction.deferReply();
            const agente = interaction.options.getString('agente').toLowerCase();
            const db = readDatabase();

            const reportStartDate = db.report_start_date ? new Date(db.report_start_date) : new Date(0);
            
            const sales = db.sales.filter(sale => {
                const saleDate = new Date(sale.timestamp);
                return saleDate >= reportStartDate && sale.vendidoPor.toLowerCase().includes(agente);
            });
            
            if (sales.length > 0) {
                const totalSalesValue = sales.reduce((sum, sale) => sum + sale.valorInterior, 0);
                const commission = totalSalesValue * 0.10;
                const salesList = sales.map(sale => `- Venda para: \`\`\`${sale.vendidoPara}\`\`\` | Valor: \`\`\`$${sale.valorInterior.toLocaleString('pt-BR')}\`\`\``).join('\n');
                
                const replyEmbed = new EmbedBuilder()
                    .setColor('#00ffff')
                    .setTitle(`📊 Relatório Semanal para ${agente.toUpperCase()}`)
                    .setDescription(`**Total de Vendas:** ${sales.length}\n**Valor Total Vendido:** \`\`\`$${totalSalesValue.toLocaleString('pt-BR')}\`\`\`\n**Comissão (10%):** \`\`\`$${commission.toLocaleString('pt-BR')}\`\`\`\n\n**Detalhes das Vendas:**\n${salesList}`);
                await interaction.editReply({ embeds: [replyEmbed] });
            } else {
                await interaction.editReply(`Não encontrei nenhuma venda para o agente "${agente}" neste período.`);
            }
        }
        
        if (commandName === 'iniciar-relatorio') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
            }
            
            const db = readDatabase();
            db.report_start_date = new Date().toISOString();
            saveDatabase(db);

            await interaction.reply({ content: 'Um novo período de relatório foi iniciado!', ephemeral: true });
        }

        if (commandName === 'finalizar-relatorio') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
            }
            
            await interaction.deferReply({ ephemeral: true });
            const db = readDatabase();

            const reportStartDate = db.report_start_date ? new Date(db.report_start_date) : new Date(0);
            const sales = db.sales.filter(sale => {
                const saleDate = new Date(sale.timestamp);
                return saleDate >= reportStartDate;
            });

            if (sales.length > 0) {
                const salesByAgent = sales.reduce((acc, sale) => {
                    const agente = sale.vendidoPor.replace(/`/g, '');
                    if (!acc[agente]) acc[agente] = { total: 0, salesCount: 0 };
                    acc[agente].total += sale.valorInterior;
                    acc[agente].salesCount++;
                    return acc;
                }, {});

                const reportFields = [];
                for (const agenteNome in salesByAgent) {
                    const totalVendas = salesByAgent[agenteNome].total;
                    const comissao = totalVendas * 0.10;
                    reportFields.push(
                        { name: `Vendedor: ${agenteNome}`, value: `**Total de Vendas:** $${totalVendas.toLocaleString('pt-BR')}\n**Comissão (10%):** $${comissao.toLocaleString('pt-BR')}`, inline: true }
                    );
                }

                const replyEmbed = new EmbedBuilder()
                    .setColor('#00ffff')
                    .setTitle('📄 Relatório Final do Período')
                    .setDescription('O relatório semanal foi finalizado. Os pagamentos de comissão devem ser processados com base nos valores abaixo.')
                    .addFields(reportFields)
                    .setTimestamp();
                
                const channel = client.channels.cache.get(channelId);
                if (channel) {
                    await channel.send({ embeds: [replyEmbed] });
                }

                db.report_start_date = new Date().toISOString();
                saveDatabase(db);
                
                await interaction.editReply({ content: 'Relatório semanal finalizado e um novo período foi iniciado com sucesso!', embeds: [], components: [] });
            } else {
                await interaction.editReply('Não encontrei nenhuma venda neste período para gerar um relatório.');
            }
        }

        if (commandName === 'venda') {
            await showVendaModal(interaction);
        }
    }
});

async function showVendaModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('venda_imovel_modal')
        .setTitle('Registrar Venda de Imóvel');
        
    const vendidoPara = new TextInputBuilder()
        .setCustomId('vendido_para_input')
        .setLabel('ID do Personagem (Comprador)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const valorInterior = new TextInputBuilder()
        .setCustomId('valor_interior_input')
        .setLabel('Valor do Interior')
        .setPlaceholder('Digite apenas números')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
        
    const temTranca = new TextInputBuilder()
        .setCustomId('tem_tranca_input')
        .setLabel('Tem tranca? (sim/não)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const comGaragem = new TextInputBuilder()
        .setCustomId('com_garagem_input')
        .setLabel('Com garagem? (sim/não)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
        
    const vendidoPor = new TextInputBuilder()
        .setCustomId('vendido_por_input')
        .setLabel('Vendido por: (Seu nome/ID)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const firstActionRow = new ActionRowBuilder().addComponents(vendidoPara);
    const secondActionRow = new ActionRowBuilder().addComponents(valorInterior);
    const thirdActionRow = new ActionRowBuilder().addComponents(temTranca);
    const fourthActionRow = new ActionRowBuilder().addComponents(comGaragem);
    const fifthActionRow = new ActionRowBuilder().addComponents(vendidoPor);
    
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
    
    await interaction.showModal(modal);
}

client.login(token);



