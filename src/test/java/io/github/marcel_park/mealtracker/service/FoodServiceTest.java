package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.repository.FoodRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FoodServiceTest {

    @Mock
    private FoodRepository repository;

    private FoodService service;

    @BeforeEach
    void setUp() {
        service = new FoodService(repository);   // Konstruktor-Injection von Hand
    }

    // ---------- Hilfsmethoden ----------

    private Food food(Long id, String name) {
        Food f = new Food();
        f.setId(id);
        f.setName(name);
        f.setKcalPer100g(372);
        f.setProtein(13.5);
        f.setCarbs(58.7);
        f.setFat(7);
        return f;
    }

    private FoodRequest request(String name) {
        return new FoodRequest(name, 372.0, 13.5, 58.7, 7.0);
    }

    // ---------- find ----------

    @Test
    void find_withoutQuery_returnsAllFoods() {
        when(repository.findAll()).thenReturn(List.of(food(1L, "Haferflocken"), food(2L, "Apfel")));

        List<FoodResponse> result = service.find(null);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(FoodResponse::name).containsExactly("Haferflocken", "Apfel");
    }

    @Test
    void find_withBlankQuery_returnsAllFoods() {
        when(repository.findAll()).thenReturn(List.of(food(1L, "Haferflocken")));

        List<FoodResponse> result = service.find("   ");

        assertThat(result).hasSize(1);
        verify(repository, never()).findByNameContainingIgnoreCase(any());
    }

    @Test
    void find_withQuery_usesNameSearch() {
        when(repository.findByNameContainingIgnoreCase("hafer"))
                .thenReturn(List.of(food(1L, "Haferflocken")));

        List<FoodResponse> result = service.find("hafer");

        assertThat(result).extracting(FoodResponse::name).containsExactly("Haferflocken");
        verify(repository, never()).findAll();
    }

    // ---------- get ----------

    @Test
    void get_existingId_returnsResponse() {
        when(repository.findById(1L)).thenReturn(Optional.of(food(1L, "Haferflocken")));

        FoodResponse result = service.get(1L);

        assertThat(result.id()).isEqualTo(1L);
        assertThat(result.name()).isEqualTo("Haferflocken");
        assertThat(result.kcalPer100g()).isEqualTo(372);
    }

    @Test
    void get_missingId_throwsNotFound() {
        when(repository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(999L))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("999");
    }

    // ---------- create ----------

    @Test
    void create_passesNewEntityWithoutIdToRepository() {
        when(repository.save(any(Food.class))).thenAnswer(inv -> inv.getArgument(0));

        service.create(request("Haferflocken"));

        ArgumentCaptor<Food> captor = ArgumentCaptor.forClass(Food.class);
        verify(repository).save(captor.capture());
        Food passed = captor.getValue();

        assertThat(passed.getId()).isNull();
        assertThat(passed.getName()).isEqualTo("Haferflocken");
        assertThat(passed.getKcalPer100g()).isEqualTo(372);
        assertThat(passed.getProtein()).isEqualTo(13.5);
        assertThat(passed.getCarbs()).isEqualTo(58.7);
        assertThat(passed.getFat()).isEqualTo(7);
    }

    @Test
    void create_returnsResponseWithIdFromRepository() {
        when(repository.save(any(Food.class))).thenAnswer(inv -> {
            Food saved = inv.getArgument(0);
            saved.setId(42L);
            return saved;
        });

        FoodResponse result = service.create(request("Haferflocken"));

        assertThat(result.id()).isEqualTo(42L);
        assertThat(result.name()).isEqualTo("Haferflocken");
    }

    // ---------- update ----------

    @Test
    void update_existingId_overwritesValues() {
        Food existing = food(1L, "Haferflocken");
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(existing);

        FoodResponse result = service.update(1L, new FoodRequest("Haferflocken zart", 370.0, 13.0, 59.0, 7.0));

        assertThat(result.id()).isEqualTo(1L);                       // ID unverändert
        assertThat(result.name()).isEqualTo("Haferflocken zart");
        assertThat(result.kcalPer100g()).isEqualTo(370);
    }

    @Test
    void update_missingId_throwsNotFoundAndSavesNothing() {
        when(repository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(999L, request("Egal")))
                .isInstanceOf(NotFoundException.class);

        verify(repository, never()).save(any());
    }

    // ---------- delete ----------

    @Test
    void delete_existingId_deletesEntity() {
        Food existing = food(1L, "Haferflocken");
        when(repository.findById(1L)).thenReturn(Optional.of(existing));

        service.delete(1L);

        verify(repository).delete(existing);
    }

    @Test
    void delete_missingId_throwsNotFoundAndDeletesNothing() {
        when(repository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(999L))
                .isInstanceOf(NotFoundException.class);

        verify(repository, never()).delete(any());
    }
}