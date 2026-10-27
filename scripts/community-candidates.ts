/**
 * Candidate subreddits per niche, for scripts/discover-communities.ts.
 *
 * Deliberately generous: the discovery script checks every name against the
 * archive (exists, public, not NSFW, subscribers, posts this week) and keeps
 * only the most active ~100 per niche, so a stale or wrong name here costs
 * one request and is dropped. `prefixes` add communities whose names start
 * with a niche term, found by the archive's subreddit search.
 */

type Candidates = { IN: string; GLOBAL: string; prefixes: string };

export const CANDIDATES: Record<string, Candidates> = {
  "tech-ai": {
    IN: "developersIndia IndiaTech indianstartups TechIndia IndianGaming india_tech_news AndroidIndia indiancoders cscareerquestionsIndia IndiaAI pcbuildindia IndianPCHardware bangalore_tech",
    GLOBAL: "technology ArtificialInteligence ChatGPT OpenAI LocalLLaMA singularity gadgets Android apple iphone programming webdev MachineLearning artificial ClaudeAI GeminiAI Bard StableDiffusion midjourney cscareerquestions sysadmin cybersecurity hardware buildapc pcmasterrace linux privacy tech Futurology learnprogramming Python javascript ProgrammerHumor startups SaaS selfhosted homelab smarthome AppleWatch mac ipad samsung GooglePixel oneplus Xiaomi nothingtech hackernews technews TechNewsToday aivideo ChatGPTPro OpenAIDev PromptEngineering AI_Agents LLMDevs perplexity_ai cursor vibecoding robotics teslamotors spacex elonmusk nvidia AMD intel computers software opensource devops ExperiencedDevs dataengineering datascience AskProgramming chrome windows Windows11 MicrosoftCopilot google",
    prefixes: "tech ai chatgpt android iphone programming coding gadget llm",
  },
  money: {
    IN: "IndiaInvestments IndianStreetBets personalfinanceindia FIREIndia IndianStockMarket StockMarketIndia mutualfunds IndiaTax CryptoIndia indianinvestors DalalStreetTalks NSEbets IndiaFinance CreditCardsIndia IndianRealEstate realestateindia",
    GLOBAL: "personalfinance stocks wallstreetbets investing CryptoCurrency Bitcoin ethereum StockMarket financialindependence Fire leanfire fatFIRE povertyfinance Frugal economy Economics options dividends ValueInvesting SecurityAnalysis RealEstate realestateinvesting CreditCards churning tax Money FinancialPlanning financialplanning eupersonalfinance UKPersonalFinance PersonalFinanceCanada AusFinance BitcoinBeginners CryptoMarkets altcoin solana dogecoin Superstonk thetagang Daytrading pennystocks smallstreetbets investing_discussion Bogleheads ETFs budget MiddleClassFinance FinancialCareers Accounting gold Silverbugs inflation PersonalFinanceNZ wallstreetbetsELITE StocksAndTrading Forex",
    prefixes: "invest stock crypto finance money trading",
  },
  startups: {
    IN: "StartUpIndia IndianEntrepreneur IndiaBusiness indianstartups Startups_India IndianSmallBusiness D2CIndia marketingindia IndianFounders",
    GLOBAL: "startups Entrepreneur smallbusiness SaaS sidehustle EntrepreneurRideAlong ycombinator venturecapital marketing digital_marketing SEO PPC ecommerce shopify dropship Etsy AmazonSeller FulfillmentByAmazon growmybusiness business Business_Ideas indiehackers microsaas nocode ProductManagement productivity sales smallbusinessuk startup_ideas juststart passive_income WorkOnline freelance Upwork copywriting content_marketing socialmedia advertising branding GrowthHacking b2bmarketing Leadership managers consulting realestate antiwork EntrepreneurConnect smallbusinessowner restaurateur franchise",
    prefixes: "startup entrepreneur business saas marketing ecommerce",
  },
  careers: {
    IN: "developersIndia cscareerquestionsIndia IndianWorkplace India_Careers jobsinindia IndiaCareers UPSC JEENEETards Indian_Academia MBAIndia CATpreparation GATE indiansabroad IndianEmployees ITjobsIndia",
    GLOBAL: "cscareerquestions careerguidance jobs antiwork recruitinghell resumes careeradvice WorkReform ITCareerQuestions overemployed remotework digitalnomad AskHR humanresources Layoffs findapath Salary interviews jobsearchhacks careerchange experienceddevs cscareerquestionsEU cscareerquestionsCAD ManagedByNarcissists work LinkedInLunatics jobhunting Teachers nursing medicine law LawSchool engineering EngineeringStudents MBA consulting FinancialCareers Accounting povertyfinance WFH workfromhome sysadmin auscorp CasualUK",
    prefixes: "career job work resume interview hiring",
  },
  fitness: {
    IN: "Fitness_India IndianFitness gymindia FitnessIndia IndianDiet IndiaRunning yogaindia",
    GLOBAL: "Fitness bodybuilding loseit gainit weightroom running xxfitness bodyweightfitness powerlifting nutrition fitness30plus homegym crossfit GYM Weightlifting naturalbodybuilding intermittentfasting keto Volumeeating MealPrepSunday EatCheapAndHealthy supplements Peptides Biohackers Ozempic Semaglutide Mounjaro WegovyWeightLoss C25K AdvancedRunning marathon triathlon cycling yoga flexibility posture backpain sleep HealthyFood PlantBasedDiet vegan workout swoleacceptance progresspics fitbit Garmin AppleWatchFitness strength_training StrongCurves calisthenics climbing bjj MuayThai boxing hiking ultrarunning",
    prefixes: "fitness gym workout running weightloss nutrition diet lift",
  },
  beauty: {
    IN: "IndianSkincareAddicts IndianMakeupAddicts IndianHaircare IndianBeautyDeals desibeauty IndianMenFashion",
    GLOBAL: "SkincareAddiction MakeupAddiction AsianBeauty tressless HaircareScience curlyhair Hair malegrooming beauty Sephora Fragrance FemaleHairLoss acne Skincare_Addiction 30PlusSkinCare SkincareAddicts Nails RedditLaqueristas Eyebrows lashextensions BeautyGuruChatter MakeupRehab PanPorn drugstoreMUA Wicked_Edge beards hairloss Minoxidil Tretinoin rosacea eczema SkincareFlatlays beautytalk makeupexchange AsianBeautyAdvice KoreanBeauty indianfashion fragrance Colognes HaircutAdvice FancyFollicles",
    prefixes: "skincare makeup beauty hair fragrance",
  },
  fashion: {
    IN: "IndianFashionAddicts IndianMenFashion indianfashion IndianStreetwear MaleFashionIndia DesiFashion SareeLovers IndianSneakers",
    GLOBAL: "malefashionadvice femalefashionadvice streetwear Sneakers frugalmalefashion OUTFITS fashion Watches malefashion womensstreetwear rawdenim goodyearwelt BuyItForLife Repsneakers FashionReps findfashion Thrifting VintageFashion womensfashion PetiteFashionAdvice plussizefashion capsulewardrobe Jewelry handbags Louisvuitton ZaraClothes uniqlo nike adidas Yeezy SneakerMarket mensfashion styleadvice sustainablefashion Shoes Sunglasses rolex PrequelMemes",
    prefixes: "fashion streetwear sneaker outfit style",
  },
  food: {
    IN: "IndianFood indiafood IndianCooking IndianFoodPhotos desifood bangalorefood MumbaiFood delhifood hyderabadfood chennaifood kolkatafood IndianVegetarian",
    GLOBAL: "food Cooking recipes AskCulinary EatCheapAndHealthy MealPrepSunday Baking FoodPorn vegan vegetarian KitchenConfidential slowcooking airfryer instantpot BBQ smoking grilling seriouseats Pizza Breadit sourdough coffee tea espresso cocktails wine beer Old_Recipes budgetfood Volumeeating FoodNYC FoodLosAngeles restaurant fastfood McDonalds Costco traderjoes AskBaking cakedecorating ramen sushi spicy hotsauce mealtimevideos castiron cookingforbeginners 1200isplenty",
    prefixes: "food cooking recipe baking coffee vegan",
  },
  entertainment: {
    IN: "bollywood BollyBlindsNGossip IndianTelevision indiancinema kollywood tollywood MalayalamMovies IndianOTT BollywoodMeme DesiMeta IndianWebSeries Kannadamovies MarathiMovies bollywoodmemes",
    GLOBAL: "movies television entertainment boxoffice popculturechat Fauxmoi marvelstudios DC_Cinematic StarWars netflix HBO HBOMax DisneyPlus PrimeVideo anime manga horror scifi TrueFilm MovieSuggestions netflixbestof gameofthrones HouseOfTheDragon thebachelor BravoRealHousewives LoveIslandTV survivor TheLastOfUs Severance StrangerThings TheBoys celebrities KUWTK taylorswift kpop popheads oscars Letterboxd shittymoviedetails moviecritic tvPlus FanTheories MovieDetails comicbooks Marvel tolkienfans witcher",
    prefixes: "movie film tv netflix anime bollywood",
  },
  music: {
    IN: "IndianMusic bollywoodmusic indianhiphop DesiHipHop IndianClassical Punjabi carnatic IndieMusicIndia IndianIndie",
    GLOBAL: "Music hiphopheads popheads indieheads kpop listentothis WeAreTheMusicMakers spotify Guitar edmproduction electronicmusic Metal LetsTalkMusic vinyl jazz classicalmusic country rnb Kanye taylorswift TheWeeknd Drizzy KendrickLamar FrankOcean billieeilish arianagrande ladygaga BeyonceKnowles Eminem radiohead MusicRecommendations ifyoulikeblank AppleMusic musicproduction audioengineering bass drums piano kpopthoughts bangtan blackpink Rap trap house techno",
    prefixes: "music hiphop kpop guitar rap",
  },
  gaming: {
    IN: "IndianGaming indiangamers BGMI IndianGamersHub gamingindia PS5India IndianPCHardware pcbuildindia ValorantIndia",
    GLOBAL: "gaming pcgaming Games PS5 NintendoSwitch Steam xbox XboxSeriesX PlayStation patientgamers GamingLeaksAndRumours truegaming gamedev indiegaming Minecraft FortNiteBR leagueoflegends VALORANT GlobalOffensive cs2 Overwatch apexlegends eldenring Genshin_Impact HonkaiStarRail pokemon gtaonline GTA6 GTA reddeadredemption Cyberpunkgame Diablo wow ffxiv destiny2 Helldivers2 Warframe RocketLeague DotA2 Competitiveoverwatch SteamDeck buildapc pcmasterrace nintendo Silksong MonsterHunter BaldursGate3 Stellar starcitizen mobilegaming PUBGMobile CallOfDuty CODWarzone",
    prefixes: "gaming game ps5 xbox steam nintendo",
  },
  sports: {
    IN: "Cricket IndianFootball ipl indiansports CricketShitpost IndianCricket kabaddi ISL Chess_India",
    GLOBAL: "sports soccer nba nfl formula1 tennis Cricket MMA ufc boxing PremierLeague reddevils LiverpoolFC Gunners chelseafc coys MCFC realmadrid Barca baseball hockey CFB golf olympics Chess chess running cycling NBA2k fantasyfootball fantasybball fantasypremierleague Bundesliga seriea LaLiga ChampionsLeague worldcup MLS wnba collegebasketball nflmemes Patriots eagles cowboys GreenBayPackers lakers warriors bostonceltics Knicks F1Technical motorsports MotoGP NASCAR WWE SquaredCircle badminton tabletennis",
    prefixes: "cricket football soccer nba nfl f1",
  },
  life: {
    IN: "AskIndia india IndianTeenagers IndianWomen TwoXIndia indianrelationships DesiRelationships IndianMarriage IndiaSpeaks indiasocial IndianParents indianmen Indian_Psychology mentalhealthindia",
    GLOBAL: "relationship_advice relationships AskWomen AskMen dating dating_advice AmItheAsshole TwoXChromosomes AskReddit offmychest TrueOffMyChest Parenting Mommit daddit raisedbynarcissists confession lonely socialskills selfimprovement getdisciplined DecidingToBeBetter Marriage Divorce breakups LongDistance BreakUps Advice NoStupidQuestions mentalhealth anxiety depression ADHD therapy introvert self askwomenadvice AskMenAdvice teenagers college UniUK CasualConversation wedding weddingplanning childfree beyondthebump BabyBumps family JUSTNOMIL AITAH",
    prefixes: "relationship dating parenting marriage mentalhealth",
  },
  news: {
    IN: "india IndiaSpeaks indianews unitedstatesofindia IndiaNonPolitical indiadiscussion librandu IndianModerate kerala Tamilnadu kolkata mumbai delhi bangalore hyderabad Chennai pune IndiaRWResources",
    GLOBAL: "worldnews news politics geopolitics europe UkrainianConflict ukraine CredibleDefense neutralnews inthenews UpliftingNews nottheonion PoliticalDiscussion Conservative Liberal moderatepolitics law climate energy environment science space Economics economy China pakistan bangladesh nepal srilanka MiddleEastNews IsraelPalestine Iran canada australia unitedkingdom AskEurope AskAnAmerican USNEWS anime_titties GlobalNews internationalpolitics AskPolitics",
    prefixes: "news politics world",
  },
  internet: {
    IN: "IndianDankMemes indiameme DesiMemes IndiaMemes SaimanSays IndianMeyMeys bakchodi dankindianmemes indianpeoplefacebook FuckYouKaren",
    GLOBAL: "memes dankmemes me_irl meirl funny OutOfTheLoop interestingasfuck nextfuckinglevel Damnthatsinteresting BeAmazed mildlyinteresting mildlyinfuriating facepalm WhitePeopleTwitter BlackPeopleTwitter PublicFreakout TikTokCringe Unexpected HolUp wholesomememes MadeMeSmile aww AnimalsBeingDerps AnimalsBeingBros rareinsults clevercomebacks therewasanattempt WTF oddlysatisfying gifs videos instant_regret Wellthatsucks ContagiousLaughter KidsAreFuckingStupid LinkedInLunatics antimeme shitposting comedyheaven ProgrammerHumor ShitPostCrusaders terriblefacebookmemes 2meirl4meirl Tinder cats dogs",
    prefixes: "meme funny dank viral",
  },
  creators: {
    IN: "IndianYoutubers IndianInfluencers YoutubeIndia indiancreators IndianPodcasts InstagramIndia DesiYoutubers",
    GLOBAL: "NewTubers youtube YouTubers Instagram InstagramMarketing TikTok Tiktokhelp socialmedia SocialMediaMarketing content_marketing contentcreation podcasting podcasts Twitch streaming videography editors VideoEditing premiere AfterEffects photography photographybusiness LinkedInTips Substack newsletters Blogging copywriting marketing digital_marketing influencermarketing UGCcreators OnlyFansAdvice youtubers PartneredYoutube SmallYTChannel youtubegaming Twitter Threads bluesky creatoreconomy kdenlive davinciresolve Canva graphic_design",
    prefixes: "youtube tiktok instagram creator podcast",
  },
  travel: {
    IN: "IndiaTravel travelindia indianbikers Kerala himachal Goa Ladakh uttarakhand rajasthan IndianTravellers IndiaTravelTips northeastindia",
    GLOBAL: "travel solotravel backpacking digitalnomad TravelHacks awardtravel churning onebag shoestring JapanTravel ThailandTourism VietNam bali europetravel ItalyTravel paris london Shoestring travelpartners TravelNoPics flights airline airlines delta unitedairlines AmericanAirlines aviation cruise Hotels AirBnB Airbnb roadtrip vandwellers camping hiking NationalPark Dubai Singapore travel_hacks Tokyo VisitingIceland GoingToSpain Turkey Morocco travelphotos",
    prefixes: "travel trip backpack flight",
  },
  education: {
    IN: "JEENEETards JEE NEET Indian_Academia UPSC CATpreparation GATE IndianTeenagers CBSE indiansabroad StudyInIndia IITs NITs BITSPilani IELTS ICSE upscmains",
    GLOBAL: "college GradSchool AskAcademia studytips learnprogramming languagelearning GetStudying Teachers education ApplyingToCollege IntltoUSA gradadmissions MBA LawSchool medicalschool premed EngineeringStudents physics math chemistry biology AskHistorians explainlikeimfive Professors UniUK unimelb StudentLoans PhD AcademicPsychology IELTS GRE GMAT SAT ACT duolingo French Spanish German LearnJapanese Korean EnglishLearning Homeschool learnmath datascience OMSCS onlinelearning",
    prefixes: "study college exam university learn",
  },
  auto: {
    IN: "CarsIndia indianbikers IndianBikes TeamBHP IndiaCars indiancars EVIndia royalenfield KTMIndia Bangalorebikers",
    GLOBAL: "cars electricvehicles teslamotors whatcarshouldIbuy motorcycles Cartalk AutoDetailing projectcar Autos carporn formula1 Porsche BMW Mercedes_Benz Audi Toyota Honda Hyundai kia Volkswagen Ford Mustang Corvette Jeep F150 Trucks rivian Lucid electricvehicle EVs RealTesla CyberStuck TeslaModelY TeslaModel3 Justrolledintotheshop MechanicAdvice motorcycle Harley ducati Kawasaki yamaha cycling ebikes Wrangler subaru mazda WRX Miata carbuying regularcarreviews IdiotsInCars dashcam",
    prefixes: "car ev motorcycle tesla bike",
  },
  cities: {
    IN: "bangalore mumbai delhi hyderabad Chennai pune kolkata gurgaon noida ahmedabad Kochi jaipur chandigarh lucknow indore Bhubaneswar Coimbatore nagpur Goa Thiruvananthapuram Surat Vadodara mangalore Mysore Patna Bhopal Guwahati visakhapatnam navimumbai thane",
    GLOBAL: "nyc LosAngeles sanfrancisco chicago london toronto vancouver seattle boston Austin houston Dallas philadelphia washingtondc Denver Portland sandiego atlanta miami phoenix melbourne sydney Dublin berlin paris amsterdam singapore dubai HongKong Tokyo bayarea brooklyn manchester Calgary montreal Edmonton Ottawa brisbane perth auckland Glasgow edinburgh stockholm Madrid barcelona rome",
    prefixes: "",
  },
};
