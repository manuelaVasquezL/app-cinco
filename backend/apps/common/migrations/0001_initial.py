from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='ConfigMenu',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('url', models.CharField(max_length=255)),
                ('nombre', models.CharField(max_length=255)),
                ('area', models.CharField(max_length=100)),
                ('carpeta', models.CharField(max_length=100)),
                ('titulo', models.CharField(max_length=255)),
                ('tabla', models.CharField(max_length=100)),
                ('estado', models.CharField(max_length=50)),
                ('tipo', models.CharField(max_length=50)),
                ('campos_importantes', models.TextField()),
                ('plantilla', models.CharField(max_length=100)),
                ('origen_base', models.CharField(max_length=100)),
                ('edit', models.CharField(max_length=100)),
                ('fecha_edit', models.DateTimeField()),
            ],
            options={
                'db_table': 'config_menu',
                'managed': False,
            },
        ),
    ]
